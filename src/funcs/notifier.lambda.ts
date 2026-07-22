import { CodePipelineClient, GetPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { EventBridgeEvent } from 'aws-lambda';
import { StrictEnvResolver, StrictEnvType } from 'strict-env-resolver';
import {
  isTerminalExecutionStatus,
  normalizeExecutionStatus,
  resolvePipelineExecutionIdentity,
} from './notifier-predicates';

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
 * Reads a required environment variable.
 */
const mustEnv = (name: string): string => StrictEnvResolver.resolve(name, StrictEnvType.String, { trim: true });

/**
 * Sleeps for the specified number of milliseconds.
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
 * Waits on a CodePipeline execution and publishes notifications whenever the execution status changes.
 */
const waitPipelineExecution = async (params: {
  topicArn: string;
  pipelineName: string;
  executionId: string;
  waitIntervalSeconds: number;
  maxWaitMinutes: number;
  startEvent: CodePipelineExecutionStartedEvent;
}): Promise<void> => {
  const {
    topicArn,
    pipelineName,
    executionId,
    waitIntervalSeconds,
    maxWaitMinutes,
    startEvent,
  } = params;

  const deadline = Date.now() + maxWaitMinutes * 60_000;
  let lastStatus: string | undefined;

  // 最初に STARTED を通知（EventBridge由来）
  await publish(topicArn, {
    type: 'codepipeline.execution',
    phase: 'eventbridge',
    pipelineName,
    executionId,
    observedState: startEvent.detail?.state ?? 'STARTED',
    observedAt: new Date().toISOString(),
    event: startEvent,
  });

  while (Date.now() < deadline) {
    const res = await codepipeline.send(new GetPipelineExecutionCommand({
      pipelineName,
      pipelineExecutionId: executionId,
    }));

    const status = normalizeExecutionStatus(res.pipelineExecution?.status);
    if (status !== lastStatus) {
      lastStatus = status;
      await publish(topicArn, {
        type: 'codepipeline.execution',
        phase: 'wait',
        pipelineName,
        executionId,
        observedState: status,
        observedAt: new Date().toISOString(),
      });
    }

    if (isTerminalExecutionStatus(status)) {
      return;
    }

    await sleep(waitIntervalSeconds * 1000);
  }

  await publish(topicArn, {
    type: 'codepipeline.execution',
    phase: 'wait',
    pipelineName,
    executionId,
    observedState: lastStatus ?? 'UNKNOWN',
    observedAt: new Date().toISOString(),
    note: 'Waiting timed out before terminal state.',
  });
};

/**
 * Lambda handler triggered by EventBridge when a pipeline execution transitions to STARTED.
 * It waits for the execution status until it reaches a terminal state or times out.
 */
export const handler = async (event: CodePipelineExecutionStartedEvent): Promise<void> => {
  const topicArn = mustEnv('SNS_TOPIC_ARN');
  const identity = resolvePipelineExecutionIdentity(
    event.detail?.pipeline,
    event.detail?.['execution-id'],
  );

  if (!identity) {
    await publish(topicArn, {
      type: 'codepipeline.execution',
      phase: 'eventbridge',
      observedAt: new Date().toISOString(),
      note: 'Missing pipelineName or executionId in event.detail',
      event,
    });
    return;
  }

  const waitIntervalSeconds = StrictEnvResolver.resolve('WAIT_INTERVAL_SECONDS', StrictEnvType.Number, { default: 10 });
  const maxWaitMinutes = StrictEnvResolver.resolve('MAX_WAIT_MINUTES', StrictEnvType.Number, { default: 14 });

  await waitPipelineExecution({
    topicArn,
    pipelineName: identity.pipelineName,
    executionId: identity.executionId,
    waitIntervalSeconds: waitIntervalSeconds > 0 ? waitIntervalSeconds : 10,
    maxWaitMinutes: maxWaitMinutes > 0 ? maxWaitMinutes : 14,
    startEvent: event,
  });
};
