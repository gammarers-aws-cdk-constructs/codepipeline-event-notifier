import { CodePipelineClient, GetPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { EventBridgeEvent } from 'aws-lambda';
import { StrictEnvResolver, StrictEnvType } from 'strict-env-resolver';

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
 * CodePipeline client used to poll execution state.
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
 * Polls a CodePipeline execution and publishes notifications whenever the execution status changes.
 */
const pollPipelineExecution = async (params: {
  topicArn: string;
  pipelineName: string;
  executionId: string;
  pollIntervalSeconds: number;
  maxPollMinutes: number;
  startEvent: CodePipelineExecutionStartedEvent;
}): Promise<void> => {
  const {
    topicArn,
    pipelineName,
    executionId,
    pollIntervalSeconds,
    maxPollMinutes,
    startEvent,
  } = params;

  const deadline = Date.now() + maxPollMinutes * 60_000;
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

    const statusRaw = res.pipelineExecution?.status ?? 'UNKNOWN';
    const status = String(statusRaw).toUpperCase();
    if (status !== lastStatus) {
      lastStatus = status;
      await publish(topicArn, {
        type: 'codepipeline.execution',
        phase: 'poll',
        pipelineName,
        executionId,
        observedState: status,
        observedAt: new Date().toISOString(),
      });
    }

    if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'STOPPED' || status === 'SUPERSEDED') {
      return;
    }

    await sleep(pollIntervalSeconds * 1000);
  }

  await publish(topicArn, {
    type: 'codepipeline.execution',
    phase: 'poll',
    pipelineName,
    executionId,
    observedState: lastStatus ?? 'UNKNOWN',
    observedAt: new Date().toISOString(),
    note: 'Polling timed out before terminal state.',
  });
};

/**
 * Lambda handler triggered by EventBridge when a pipeline execution transitions to STARTED.
 * It polls the execution status until it reaches a terminal state or times out.
 */
export const handler = async (event: CodePipelineExecutionStartedEvent): Promise<void> => {
  const topicArn = mustEnv('SNS_TOPIC_ARN');
  const pipelineName = event.detail?.pipeline;
  const executionId = event.detail?.['execution-id'];

  if (!pipelineName || !executionId) {
    await publish(topicArn, {
      type: 'codepipeline.execution',
      phase: 'eventbridge',
      observedAt: new Date().toISOString(),
      note: 'Missing pipelineName or executionId in event.detail',
      event,
    });
    return;
  }

  const pollIntervalSeconds = StrictEnvResolver.resolve('POLL_INTERVAL_SECONDS', StrictEnvType.Number, { default: 10 });
  const maxPollMinutes = StrictEnvResolver.resolve('MAX_POLL_MINUTES', StrictEnvType.Number, { default: 14 });

  await pollPipelineExecution({
    topicArn,
    pipelineName,
    executionId,
    pollIntervalSeconds: pollIntervalSeconds > 0 ? pollIntervalSeconds : 10,
    maxPollMinutes: maxPollMinutes > 0 ? maxPollMinutes : 14,
    startEvent: event,
  });
};
