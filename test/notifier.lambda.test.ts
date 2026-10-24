import { LocalDurableTestRunner } from '@aws/durable-execution-sdk-js-testing';
import {
  GetPipelineExecutionCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-codepipeline';
import type { EventBridgeEvent } from 'aws-lambda';

const mockSnsSend = jest.fn();
const mockCodePipelineSend = jest.fn();
const mockListTagsSend = jest.fn();
const mockGetExecutionSend = jest.fn();

jest.mock('@aws-sdk/client-sns', () => {
  const actual = jest.requireActual('@aws-sdk/client-sns') as typeof import('@aws-sdk/client-sns');
  return {
    ...actual,
    SNSClient: jest.fn().mockImplementation(() => ({
      send: mockSnsSend,
    })),
  };
});

jest.mock('@aws-sdk/client-codepipeline', () => {
  const actual = jest.requireActual('@aws-sdk/client-codepipeline') as typeof import('@aws-sdk/client-codepipeline');
  return {
    ...actual,
    CodePipelineClient: jest.fn().mockImplementation(() => ({
      send: mockCodePipelineSend,
    })),
  };
});

import { handler } from '../src/funcs/notifier.lambda';

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
const TARGET_PIPELINE_TAGS = JSON.stringify([
  { key: 'Notify', values: ['true'] },
]);

const makeEvent = (
  detail: CodePipelineExecutionStartedDetail = {
    'pipeline': 'my-pipeline',
    'state': 'STARTED',
    'execution-id': 'exec-1',
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

const publishedPayloads = (): Array<Record<string, unknown>> => mockSnsSend.mock.calls.map((call) => {
  const command = call[0] as { input: { Message: string } };
  return JSON.parse(command.input.Message) as Record<string, unknown>;
});

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
    jest.clearAllMocks();
    process.env.SNS_TOPIC_ARN = TOPIC_ARN;
    process.env.WAIT_INTERVAL_SECONDS = '1';
    process.env.MAX_WAIT_MINUTES = '1';
    process.env.TARGET_PIPELINE_TAGS = TARGET_PIPELINE_TAGS;
    mockSnsSend.mockResolvedValue({});
    mockListTagsSend.mockResolvedValue({
      tags: [{ key: 'Notify', value: 'true' }],
    });
    mockCodePipelineSend.mockImplementation((command: unknown) => {
      if (command instanceof ListTagsForResourceCommand) {
        return mockListTagsSend(command);
      }
      if (command instanceof GetPipelineExecutionCommand) {
        return mockGetExecutionSend(command);
      }
      return Promise.reject(new Error('unexpected CodePipeline command'));
    });
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
        detail: { pipeline: 'my-pipeline', state: 'STARTED' },
      },
      {
        name: 'missing pipeline',
        detail: { 'state': 'STARTED', 'execution-id': 'exec-1' },
      },
    ])('publishes an error note when $name', async ({ detail }) => {
      const execution = await runHandler(makeEvent(detail));

      expect(execution.getStatus()).toBe('SUCCEEDED');
      expect(mockListTagsSend).not.toHaveBeenCalled();
      expect(mockGetExecutionSend).not.toHaveBeenCalled();
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
    expect(mockListTagsSend).not.toHaveBeenCalled();
    expect(mockGetExecutionSend).not.toHaveBeenCalled();
    expect(publishedPayloads()).toEqual([]);
  });

  it('looks up tags when the pipeline ARN is allowlisted', async () => {
    process.env.TARGET_PIPELINE_ARNS = JSON.stringify([PIPELINE_ARN]);
    mockGetExecutionSend.mockResolvedValueOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(mockListTagsSend).toHaveBeenCalledTimes(1);
    expect(mockGetExecutionSend).toHaveBeenCalledTimes(1);
  });

  it('ignores executions when pipeline tags do not match', async () => {
    mockListTagsSend.mockResolvedValueOnce({
      tags: [{ key: 'Notify', value: 'false' }],
    });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(mockListTagsSend).toHaveBeenCalledTimes(1);
    expect(mockGetExecutionSend).not.toHaveBeenCalled();
    expect(publishedPayloads()).toEqual([]);
  });

  it('looks up tags with the EventBridge resource ARN', async () => {
    mockGetExecutionSend.mockResolvedValueOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await runHandler(makeEvent());

    expect(mockListTagsSend).toHaveBeenCalledWith(expect.any(ListTagsForResourceCommand));
    const command = mockListTagsSend.mock.calls[0][0] as ListTagsForResourceCommand;
    expect(command.input.resourceArn).toBe(PIPELINE_ARN);
  });

  it('falls back to a constructed pipeline ARN when resources are empty', async () => {
    mockGetExecutionSend.mockResolvedValueOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await runHandler(makeEvent(undefined, []));

    const command = mockListTagsSend.mock.calls[0][0] as ListTagsForResourceCommand;
    expect(command.input.resourceArn).toBe(PIPELINE_ARN);
  });

  it('fails when the pipeline ARN cannot be resolved', async () => {
    const event = makeEvent(undefined, []);
    const execution = await runHandler({
      ...event,
      region: '',
      account: '',
    });

    expect(execution.getStatus()).toBe('FAILED');
    expect(mockGetExecutionSend).not.toHaveBeenCalled();
    expect(publishedPayloads()).toEqual([]);
  });

  describe('terminal execution status', () => {
    it.each([
      { status: 'Succeeded', observedState: 'SUCCEEDED' },
      { status: 'Failed', observedState: 'FAILED' },
      { status: 'Stopped', observedState: 'STOPPED' },
      { status: 'Superseded', observedState: 'SUPERSEDED' },
    ])('stops waiting when status becomes $status', async ({ status, observedState }) => {
      mockGetExecutionSend.mockResolvedValueOnce({
        pipelineExecution: { status },
      });

      const execution = await runHandler(makeEvent());

      expect(execution.getStatus()).toBe('SUCCEEDED');
      expect(mockGetExecutionSend).toHaveBeenCalledTimes(1);
      expect(publishedPayloads()).toEqual([
        expect.objectContaining({
          phase: 'eventbridge',
          observedState: 'STARTED',
          pipelineName: 'my-pipeline',
          executionId: 'exec-1',
        }),
        expect.objectContaining({
          phase: 'wait',
          observedState,
          pipelineName: 'my-pipeline',
          executionId: 'exec-1',
        }),
      ]);
      expect(publishedPayloads().some((payload) => payload.note === 'Waiting timed out before terminal state.')).toBe(false);
    });
  });

  it('publishes status transitions until a terminal state', async () => {
    mockGetExecutionSend
      .mockResolvedValueOnce({ pipelineExecution: { status: 'InProgress' } })
      .mockResolvedValueOnce({ pipelineExecution: { status: 'InProgress' } })
      .mockResolvedValueOnce({ pipelineExecution: { status: 'Succeeded' } });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(mockGetExecutionSend).toHaveBeenCalledTimes(3);
    expect(publishedPayloads()).toEqual([
      expect.objectContaining({ phase: 'eventbridge', observedState: 'STARTED' }),
      expect.objectContaining({ phase: 'wait', observedState: 'INPROGRESS' }),
      expect.objectContaining({ phase: 'wait', observedState: 'SUCCEEDED' }),
    ]);
  });

  it('publishes a timeout note when the wait attempt budget elapses', async () => {
    process.env.WAIT_INTERVAL_SECONDS = '30';
    process.env.MAX_WAIT_MINUTES = '1';
    mockGetExecutionSend.mockResolvedValue({
      pipelineExecution: { status: 'InProgress' },
    });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    const payloads = publishedPayloads();
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
    // 1 minute / 30 seconds = 2 attempts
    expect(mockGetExecutionSend).toHaveBeenCalledTimes(2);
  });

  it('defaults observedState to STARTED when detail.state is absent', async () => {
    mockGetExecutionSend.mockResolvedValueOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await runHandler(makeEvent({
      'pipeline': 'my-pipeline',
      'execution-id': 'exec-1',
    }));

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
    mockGetExecutionSend.mockResolvedValueOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    const execution = await runHandler(makeEvent());

    expect(execution.getStatus()).toBe('SUCCEEDED');
    expect(mockGetExecutionSend).toHaveBeenCalledTimes(1);
    expect(publishedPayloads()).toHaveLength(2);
  });
});
