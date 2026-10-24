import { withDurableExecution, type DurableContext } from '@aws/durable-execution-sdk-js';
import { CodePipelineClient, GetPipelineExecutionCommand, ListTagsForResourceCommand } from '@aws-sdk/client-codepipeline';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { EventBridgeEvent } from 'aws-lambda';
import { StrictEnvResolver, StrictEnvType } from 'strict-env-resolver';
import {
  isTerminalExecutionStatus,
  normalizeExecutionStatus,
  resolvePipelineExecutionIdentity,
} from './notifier-predicates';
import {
  isAllowedPipelineArn,
  matchesTargetPipelineTags,
  parseAllowedPipelineArns,
  parseTargetPipelineTags,
  resolvePipelineArn,
  toPipelineTagMap,
} from './target-pipeline-predicates';

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
 * SNS client used to publish notifications.
 */
const sns = new SNSClient({});

/**
 * CodePipeline client used to wait for execution state changes.
 */
const codepipeline = new CodePipelineClient({});

/**
 * Default wait interval in seconds when the env value is missing or invalid.
 */
const DEFAULT_WAIT_INTERVAL_SECONDS = 10;

/**
 * Default maximum wait duration in minutes when the env value is missing or invalid.
 */
const DEFAULT_MAX_WAIT_MINUTES = 14;

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
 * Resolves how many GetPipelineExecution attempts fit into the max wait window.
 */
const resolveMaxAttempts = (waitIntervalSeconds: number, maxWaitMinutes: number): number => {
  return Math.max(1, Math.ceil((maxWaitMinutes * 60) / waitIntervalSeconds));
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
      return;
    }

    if (attempt + 1 >= maxAttempts) {
      break;
    }

    await durable.wait(`wait-${attempt}`, { seconds: waitIntervalSeconds });
  }

  await durable.step('publish-timeout', async () => {
    await publish(topicArn, {
      type: 'codepipeline.execution',
      phase: 'wait',
      pipelineName,
      executionId,
      observedState: lastStatus ?? 'UNKNOWN',
      observedAt: new Date().toISOString(),
      note: 'Waiting timed out before terminal state.',
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
  const tagFilters = parseTargetPipelineTags(mustEnv('TARGET_PIPELINE_TAGS'));
  const pipelineArn = resolvePipelineArn(
    event.resources,
    event.region,
    event.account,
    pipelineName,
  );
  if (!pipelineArn) {
    throw new Error('Unable to resolve pipeline ARN for tag lookup');
  }

  const allowedArns = parseAllowedPipelineArns(process.env.TARGET_PIPELINE_ARNS);
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
  const topicArn = mustEnv('SNS_TOPIC_ARN');
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

  const waitIntervalSecondsRaw = StrictEnvResolver.resolve('WAIT_INTERVAL_SECONDS', StrictEnvType.Number, {
    default: DEFAULT_WAIT_INTERVAL_SECONDS,
  });
  const maxWaitMinutesRaw = StrictEnvResolver.resolve('MAX_WAIT_MINUTES', StrictEnvType.Number, {
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
