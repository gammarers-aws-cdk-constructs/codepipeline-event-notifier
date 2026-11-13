import { LocalDurableTestRunner } from '@aws/durable-execution-sdk-js-testing';
import {
  CodePipelineClient,
  GetPipelineExecutionCommand,
  ListTagsForResourceCommand,
  PipelineExecutionStatus,
} from '@aws-sdk/client-codepipeline';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { EventBridgeEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { handler } from '../src/funcs/notifier.lambda';

const snsMock = mockClient(SNSClient);
const codepipelineMock = mockClient(CodePipelineClient);

type CodePipelineExecutionStartedDetail = {
  'pipeline'?: string;
  'state'?: string;
  'version'?: string;
  'execution-id'?: string;
};

type CodePipelineExecutionStartedEvent = EventBridgeEvent<
  'CodePipeline Pipeline Execution State Change',
  CodePipelineExecutionStartedDetail
>;

const TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:pipeline-events';
const PIPELINE_ARN = 'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline';
const PIPELINE_NAME = 'my-pipeline';
const EXECUTION_ID = 'exec-1';
const TARGET_PIPELINE_TAGS = JSON.stringify([
  { key: 'Notify', values: ['true'] },
]);

const makeEvent = (
  detail: CodePipelineExecutionStartedDetail = {
    'pipeline': PIPELINE_NAME,
    'state': 'STARTED',
    'execution-id': EXECUTION_ID,
  },
  resources: string[] = [PIPELINE_ARN],
): CodePipelineExecutionStartedEvent => ({
  'version': '0',
  'id': 'event-1',
  'detail-type': 'CodePipeline Pipeline Execution State Change',
  'source': 'aws.codepipeline',
  'account': '123456789012',
  'time': '2026-01-01T00:00:00Z',
  'region': 'us-east-1',
  resources,
  detail,
});

const publishedPayloads = (): Array<Record<string, unknown>> =>
  snsMock.commandCalls(PublishCommand).map((call) => {
    const message = call.args[0].input.Message;
    if (typeof message !== 'string') {
      throw new Error('PublishCommand Message must be a string');
    }
    const parsed: unknown = JSON.parse(message);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('PublishCommand Message must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  });

const expectPublishedToTopic = (times: number): void => {
  expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, times);
  expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
    TopicArn: TOPIC_ARN,
  });
};

const expectPipelineLookup = (): void => {
  expect(codepipelineMock).toHaveReceivedCommandWith(ListTagsForResourceCommand, {
    resourceArn: PIPELINE_ARN,
  });
  expect(codepipelineMock).toHaveReceivedCommandWith(GetPipelineExecutionCommand, {
    pipelineName: PIPELINE_NAME,
    pipelineExecutionId: EXECUTION_ID,
  });
};

const runHandler = async (event: CodePipelineExecutionStartedEvent) => {
  const runner = new LocalDurableTestRunner({
    handlerFunction: handler,
  });
  return runner.run({ payload: event });
};

describe('notifier.lambda handler', () => {
  beforeAll(async () => {
    await LocalDurableTestRunner.setupTestEnvironment({
      skipTime: true,
    });
  });

  afterAll(async () => {
    await LocalDurableTestRunner.teardownTestEnvironment();
  });

  beforeEach(() => {
    snsMock.reset();
    codepipelineMock.reset();
    snsMock.on(PublishCommand).resolves({});
    codepipelineMock.on(ListTagsForResourceCommand).resolves({
      tags: [{ key: 'Notify', value: 'true' }],
    });
    process.env.SNS_TOPIC_ARN = TOPIC_ARN;
    process.env.WAIT_INTERVAL_SECONDS = '1';
    process.env.MAX_WAIT_MINUTES = '1';
    process.env.TARGET_PIPELINE_TAGS = TARGET_PIPELINE_TAGS;
  });

  afterEach(() => {
    delete process.env.SNS_TOPIC_ARN;
    delete process.env.WAIT_INTERVAL_SECONDS;
    delete process.env.MAX_WAIT_MINUTES;
    delete process.env.TARGET_PIPELINE_TAGS;
    delete process.env.TARGET_PIPELINE_ARNS;
  });

  describe('missing event.detail identity', () => {
    it.each([
      {
        name: 'empty detail',
        detail: {},
      },
      {
        name: 'missing execution-id',
        detail: { pipeline: PIPELINE_NAME, state: 'STARTED' },
      },
      {
        name: 'missing pipeline',
        detail: { 'state': 'STARTED', 'execution-id': EXECUTION_ID },
      },
    ])('publishes an error note when $name', async ({ detail }) => {
      const execution = await runHandler(makeEvent(detail));

      expect(execution.getStatus()).toBe('SUCCEEDED');
      expect(codepipelineMock).not.toHaveReceivedCommand(ListTagsForResourceCommand);
      expect(codepipelineMock).not.toHaveReceivedCommand(GetPipelineExecutionCommand);
      expectPublishedToTopic(1);
      expect(publishedPayloads()).toEqual([
        expect.objectContaining({
          type: 'codepipeline.execution',
          phase: 'eventbridge',
          note: 'Missing pipelineName or executionId in event.detail',
        }),
      ]);
    });
  });

  it('ignores executions when the pipeline ARN is not allowlisted', async () => {
    process.env.TARGET_PIPELINE_ARNS = JSON.stringify([
      'arn:aws:codepipeline:us-east-1:123456789012:other-pipeline',
    ]);

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(codepipelineMock).not.toHaveReceivedCommand(ListTagsForResourceCommand);
    expect(codepipelineMock).not.toHaveReceivedCommand(GetPipelineExecutionCommand);
    expect(snsMock).not.toHaveReceivedCommand(PublishCommand);
  });

  it('looks up tags when the pipeline ARN is allowlisted', async () => {
    process.env.TARGET_PIPELINE_ARNS = JSON.stringify([PIPELINE_ARN]);
    codepipelineMock.on(GetPipelineExecutionCommand).resolvesOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(codepipelineMock).toHaveReceivedCommandTimes(ListTagsForResourceCommand, 1);
    expect(codepipelineMock).toHaveReceivedCommandTimes(GetPipelineExecutionCommand, 1);
    expectPipelineLookup();
  });

  it('ignores executions when pipeline tags do not match', async () => {
    codepipelineMock.on(ListTagsForResourceCommand).resolvesOnce({
      tags: [{ key: 'Notify', value: 'false' }],
    });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(codepipelineMock).toHaveReceivedCommandTimes(ListTagsForResourceCommand, 1);
    expect(codepipelineMock).toHaveReceivedCommandWith(ListTagsForResourceCommand, {
      resourceArn: PIPELINE_ARN,
    });
    expect(codepipelineMock).not.toHaveReceivedCommand(GetPipelineExecutionCommand);
    expect(snsMock).not.toHaveReceivedCommand(PublishCommand);
  });

  it('looks up tags with the EventBridge resource ARN', async () => {
    codepipelineMock.on(GetPipelineExecutionCommand).resolvesOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await runHandler(makeEvent());

    expect(codepipelineMock).toHaveReceivedCommandWith(ListTagsForResourceCommand, {
      resourceArn: PIPELINE_ARN,
    });
  });

  it('falls back to a constructed pipeline ARN when resources are empty', async () => {
    codepipelineMock.on(GetPipelineExecutionCommand).resolvesOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await runHandler(makeEvent(undefined, []));

    expect(codepipelineMock).toHaveReceivedCommandWith(ListTagsForResourceCommand, {
      resourceArn: PIPELINE_ARN,
    });
  });

  it('fails when the pipeline ARN cannot be resolved', async () => {
    const event = makeEvent(undefined, []);
    const execution = await runHandler({
      ...event,
      region: '',
      account: '',
    });

    expect(execution.getStatus()).toBe('FAILED');
    expect(codepipelineMock).not.toHaveReceivedCommand(ListTagsForResourceCommand);
    expect(codepipelineMock).not.toHaveReceivedCommand(GetPipelineExecutionCommand);
    expect(snsMock).not.toHaveReceivedCommand(PublishCommand);
  });

  describe('terminal execution status', () => {
    it.each([
      { status: 'Succeeded', observedState: 'SUCCEEDED' },
      { status: 'Failed', observedState: 'FAILED' },
      { status: 'Stopped', observedState: 'STOPPED' },
      { status: 'Superseded', observedState: 'SUPERSEDED' },
    ])('stops waiting when status becomes $status', async ({ status, observedState }) => {
      codepipelineMock.on(GetPipelineExecutionCommand).resolvesOnce({
        pipelineExecution: { status: status as unknown as PipelineExecutionStatus },
      });

      const execution = await runHandler(makeEvent());

      expect(execution.getStatus()).toBe('SUCCEEDED');
      expect(codepipelineMock).toHaveReceivedCommandTimes(GetPipelineExecutionCommand, 1);
      expectPipelineLookup();
      expectPublishedToTopic(2);
      expect(publishedPayloads()).toEqual([
        expect.objectContaining({
          phase: 'eventbridge',
          observedState: 'STARTED',
          pipelineName: PIPELINE_NAME,
          executionId: EXECUTION_ID,
        }),
        expect.objectContaining({
          phase: 'wait',
          observedState,
          pipelineName: PIPELINE_NAME,
          executionId: EXECUTION_ID,
        }),
      ]);
      expect(publishedPayloads().some((payload) => payload.note === 'Waiting timed out before terminal state.')).toBe(false);
    });
  });

  it('publishes status transitions until a terminal state', async () => {
    codepipelineMock
      .on(GetPipelineExecutionCommand)
      .resolvesOnce({ pipelineExecution: { status: 'InProgress' } })
      .resolvesOnce({ pipelineExecution: { status: 'InProgress' } })
      .resolvesOnce({ pipelineExecution: { status: 'Succeeded' } });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(codepipelineMock).toHaveReceivedCommandTimes(GetPipelineExecutionCommand, 3);
    expectPipelineLookup();
    expectPublishedToTopic(3);
    expect(publishedPayloads()).toEqual([
      expect.objectContaining({ phase: 'eventbridge', observedState: 'STARTED' }),
      expect.objectContaining({ phase: 'wait', observedState: 'INPROGRESS' }),
      expect.objectContaining({ phase: 'wait', observedState: 'SUCCEEDED' }),
    ]);
  });

  it('publishes a timeout note when the wait attempt budget elapses', async () => {
    process.env.WAIT_INTERVAL_SECONDS = '30';
    process.env.MAX_WAIT_MINUTES = '1';
    codepipelineMock.on(GetPipelineExecutionCommand).resolves({
      pipelineExecution: { status: 'InProgress' },
    });

    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('PipelineExecutionWaitTimedOut'));
    errorLog.mockRestore();
    expect(codepipelineMock).toHaveReceivedCommandTimes(GetPipelineExecutionCommand, 2);
    expectPipelineLookup();
    const payloads = publishedPayloads();
    expectPublishedToTopic(payloads.length);
    expect(payloads[0]).toEqual(expect.objectContaining({
      phase: 'eventbridge',
      observedState: 'STARTED',
    }));
    expect(payloads[1]).toEqual(expect.objectContaining({
      phase: 'wait',
      observedState: 'INPROGRESS',
    }));
    expect(payloads[payloads.length - 1]).toEqual(expect.objectContaining({
      phase: 'wait',
      observedState: 'INPROGRESS',
      note: 'Waiting timed out before terminal state.',
    }));
  });

  it('defaults observedState to STARTED when detail.state is absent', async () => {
    codepipelineMock.on(GetPipelineExecutionCommand).resolvesOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await runHandler(makeEvent({
      'pipeline': PIPELINE_NAME,
      'execution-id': EXECUTION_ID,
    }));

    expectPublishedToTopic(2);
    expect(publishedPayloads()[0]).toEqual(expect.objectContaining({
      phase: 'eventbridge',
      observedState: 'STARTED',
    }));
  });

  it.each([
    { waitIntervalSeconds: '0', maxWaitMinutes: '0' },
    { waitIntervalSeconds: '-1', maxWaitMinutes: '-5' },
  ])('falls back to default wait settings when env values are $waitIntervalSeconds / $maxWaitMinutes', async ({
    waitIntervalSeconds,
    maxWaitMinutes,
  }) => {
    process.env.WAIT_INTERVAL_SECONDS = waitIntervalSeconds;
    process.env.MAX_WAIT_MINUTES = maxWaitMinutes;
    codepipelineMock.on(GetPipelineExecutionCommand).resolvesOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(codepipelineMock).toHaveReceivedCommandTimes(GetPipelineExecutionCommand, 1);
    expectPipelineLookup();
    expectPublishedToTopic(2);
  });
});
