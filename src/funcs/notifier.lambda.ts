import { withDurableExecution, type DurableContext } from '@aws/durable-execution-sdk-js';
import { CodePipelineClient, GetPipelineExecutionCommand, ListTagsForResourceCommand } from '@aws-sdk/client-codepipeline';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { EventBridgeEvent } from 'aws-lambda';
import { StrictEnvResolver, StrictEnvType } from 'strict-env-resolver';
import {
  hasMoreWaitAttempts,
  isTerminalExecutionStatus,
  normalizeExecutionStatus,
  resolveMaxAttempts,
  resolvePipelineExecutionIdentity,
} from './core/notifier-predicates';
import {
  isAllowedPipelineArn,
  matchesTargetPipelineTags,
  parseAllowedPipelineArns,
  parseTargetPipelineTags,
  resolvePipelineArn,
  toPipelineTagMap,
} from './core/target-pipeline-predicates';
import {
  DEFAULT_MAX_WAIT_MINUTES,
  DEFAULT_WAIT_INTERVAL_SECONDS,
  ENV_MAX_WAIT_MINUTES,
  ENV_SNS_TOPIC_ARN,
  ENV_TARGET_PIPELINE_ARNS,
  ENV_TARGET_PIPELINE_TAGS,
  ENV_WAIT_INTERVAL_SECONDS,
} from '../settings/consts';

/**
 * EventBridge detail payload for CodePipeline execution state-change events.
 */
type CodePipelineExecutionStartedDetail = {
  'pipeline'?: string;
  'state'?: string;
  'version'?: string;
  'execution-id'?: string;
};

/**
 * EventBridge event for CodePipeline execution state-change notifications.
 */
type CodePipelineExecutionStartedEvent = EventBridgeEvent<
  'CodePipeline Pipeline Execution State Change',
  CodePipelineExecutionStartedDetail
>;

/**
 * Note published when waiting ends without a terminal execution status.
 */
const WAIT_TIMEOUT_NOTE = 'Waiting timed out before terminal state.';

/**
 * SNS client used to publish notifications.
 */
const sns = new SNSClient({
  maxAttempts: 3,
});

/**
 * CodePipeline client used to wait for execution state changes.
 */
const codepipeline = new CodePipelineClient({
  maxAttempts: 3,
});

/**
 * Reads a required environment variable.
 */
const mustEnv = (name: string): string => StrictEnvResolver.resolve(name, StrictEnvType.String, { trim: true });

/**
 * Publishes a JSON payload to the given SNS topic ARN.
 */
const publish = async (topicArn: string, payload: unknown): Promise<void> => {
  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(payload),
  }));
};

/**
 * Waits on a CodePipeline execution with durable steps/waits and publishes SNS on status changes.
 */
const waitPipelineExecution = async (params: {
  durable: DurableContext;
  topicArn: string;
  pipelineName: string;
  executionId: string;
  waitIntervalSeconds: number;
  maxWaitMinutes: number;
  startEvent: CodePipelineExecutionStartedEvent;
}): Promise<void> => {
  const {
    durable,
    topicArn,
    pipelineName,
    executionId,
    waitIntervalSeconds,
    maxWaitMinutes,
    startEvent,
  } = params;

  const maxAttempts = resolveMaxAttempts(waitIntervalSeconds, maxWaitMinutes);
  let lastStatus: string | undefined;
  let reachedTerminal = false;

  await durable.step('publish-started', async () => {
    await publish(topicArn, {
      type: 'codepipeline.execution',
      phase: 'eventbridge',
      pipelineName,
      executionId,
      observedState: startEvent.detail?.state ?? 'STARTED',
      observedAt: new Date().toISOString(),
      event: startEvent,
    });
  });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await durable.step(`get-status-${attempt}`, async () => {
      const res = await codepipeline.send(new GetPipelineExecutionCommand({
        pipelineName,
        pipelineExecutionId: executionId,
      }));
      return normalizeExecutionStatus(res.pipelineExecution?.status);
    });

    if (status !== lastStatus) {
      lastStatus = status;
      await durable.step(`publish-status-${attempt}`, async () => {
        await publish(topicArn, {
          type: 'codepipeline.execution',
          phase: 'wait',
          pipelineName,
          executionId,
          observedState: status,
          observedAt: new Date().toISOString(),
        });
      });
    }

    if (isTerminalExecutionStatus(status)) {
      reachedTerminal = true;
      break;
    }

    if (!hasMoreWaitAttempts(attempt, maxAttempts)) {
      break;
    }

    await durable.wait(`wait-${attempt}`, { seconds: waitIntervalSeconds });
  }

  if (reachedTerminal) {
    return;
  }

  await durable.step('publish-timeout', async () => {
    await publish(topicArn, {
      type: 'codepipeline.execution',
      phase: 'wait',
      pipelineName,
      executionId,
      observedState: lastStatus ?? 'UNKNOWN',
      observedAt: new Date().toISOString(),
      note: WAIT_TIMEOUT_NOTE,
    });
  });
};

/**
 * Returns whether the pipeline in the event matches the configured tag filters.
 *
 * @param event EventBridge STARTED event
 * @param pipelineName pipeline name from the event detail
 * @returns true when the pipeline should be notified
 */
const isTargetPipelineEvent = async (
  event: CodePipelineExecutionStartedEvent,
  pipelineName: string,
): Promise<boolean> => {
  const tagFilters = parseTargetPipelineTags(mustEnv(ENV_TARGET_PIPELINE_TAGS));
  const pipelineArn = resolvePipelineArn(
    event.resources,
    event.region,
    event.account,
    pipelineName,
  );
  if (!pipelineArn) {
    throw new Error('Unable to resolve pipeline ARN for tag lookup');
  }

  const targetPipelineArnsRaw = StrictEnvResolver.resolve(ENV_TARGET_PIPELINE_ARNS, StrictEnvType.String, {
    default: '',
    trim: true,
  });
  const allowedArns = parseAllowedPipelineArns(
    targetPipelineArnsRaw === '' ? undefined : targetPipelineArnsRaw,
  );
  if (!isAllowedPipelineArn(pipelineArn, allowedArns)) {
    return false;
  }

  const listed = await codepipeline.send(new ListTagsForResourceCommand({
    resourceArn: pipelineArn,
  }));

  return matchesTargetPipelineTags(toPipelineTagMap(listed.tags), tagFilters);
};

/**
 * Durable handler triggered by EventBridge when a pipeline execution transitions to STARTED.
 * It ignores pipelines that do not match `TARGET_PIPELINE_TAGS` (and optional `TARGET_PIPELINE_ARNS`),
 * then waits for a terminal state with durable waits between GetPipelineExecution calls.
 */
const handleEvent = async (
  event: CodePipelineExecutionStartedEvent,
  durable: DurableContext,
): Promise<void> => {
  const topicArn = mustEnv(ENV_SNS_TOPIC_ARN);
  const identity = resolvePipelineExecutionIdentity(
    event.detail?.pipeline,
    event.detail?.['execution-id'],
  );

  if (!identity) {
    await durable.step('publish-missing-identity', async () => {
      await publish(topicArn, {
        type: 'codepipeline.execution',
        phase: 'eventbridge',
        observedAt: new Date().toISOString(),
        note: 'Missing pipelineName or executionId in event.detail',
        event,
      });
    });
    return;
  }

  const isTarget = await durable.step('resolve-target-pipeline', async () => {
    return isTargetPipelineEvent(event, identity.pipelineName);
  });
  if (!isTarget) {
    return;
  }

  const waitIntervalSecondsRaw = StrictEnvResolver.resolve(ENV_WAIT_INTERVAL_SECONDS, StrictEnvType.Number, {
    default: DEFAULT_WAIT_INTERVAL_SECONDS,
  });
  const maxWaitMinutesRaw = StrictEnvResolver.resolve(ENV_MAX_WAIT_MINUTES, StrictEnvType.Number, {
    default: DEFAULT_MAX_WAIT_MINUTES,
  });

  await waitPipelineExecution({
    durable,
    topicArn,
    pipelineName: identity.pipelineName,
    executionId: identity.executionId,
    waitIntervalSeconds: waitIntervalSecondsRaw > 0 ? waitIntervalSecondsRaw : DEFAULT_WAIT_INTERVAL_SECONDS,
    maxWaitMinutes: maxWaitMinutesRaw > 0 ? maxWaitMinutesRaw : DEFAULT_MAX_WAIT_MINUTES,
    startEvent: event,
  });
};

/**
 * Lambda entrypoint wrapped for durable execution.
 */
export const handler = withDurableExecution(handleEvent);
