import type { EventBridgeEvent } from 'aws-lambda';

const mockSnsSend = jest.fn();
const mockCodePipelineSend = jest.fn();

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

const makeEvent = (
  detail: CodePipelineExecutionStartedDetail = {
    'pipeline': 'my-pipeline',
    'state': 'STARTED',
    'execution-id': 'exec-1',
  },
): CodePipelineExecutionStartedEvent => ({
  'version': '0',
  'id': 'event-1',
  'detail-type': 'CodePipeline Pipeline Execution State Change',
  'source': 'aws.codepipeline',
  'account': '123456789012',
  'time': '2026-01-01T00:00:00Z',
  'region': 'us-east-1',
  'resources': [],
  detail,
});

const publishedPayloads = (): Array<Record<string, unknown>> => mockSnsSend.mock.calls.map((call) => {
  const command = call[0] as { input: { Message: string } };
  return JSON.parse(command.input.Message) as Record<string, unknown>;
});

describe('notifier.lambda handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    process.env.SNS_TOPIC_ARN = TOPIC_ARN;
    process.env.WAIT_INTERVAL_SECONDS = '1';
    process.env.MAX_WAIT_MINUTES = '1';
    mockSnsSend.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete process.env.SNS_TOPIC_ARN;
    delete process.env.WAIT_INTERVAL_SECONDS;
    delete process.env.MAX_WAIT_MINUTES;
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
      await handler(makeEvent(detail));

      expect(mockCodePipelineSend).not.toHaveBeenCalled();
      expect(publishedPayloads()).toEqual([
        expect.objectContaining({
          type: 'codepipeline.execution',
          phase: 'eventbridge',
          note: 'Missing pipelineName or executionId in event.detail',
        }),
      ]);
    });
  });

  describe('terminal execution status', () => {
    it.each([
      { status: 'Succeeded', observedState: 'SUCCEEDED' },
      { status: 'Failed', observedState: 'FAILED' },
      { status: 'Stopped', observedState: 'STOPPED' },
      { status: 'Superseded', observedState: 'SUPERSEDED' },
    ])('stops waiting when status becomes $status', async ({ status, observedState }) => {
      mockCodePipelineSend.mockResolvedValueOnce({
        pipelineExecution: { status },
      });

      await handler(makeEvent());

      expect(mockCodePipelineSend).toHaveBeenCalledTimes(1);
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
    mockCodePipelineSend
      .mockResolvedValueOnce({ pipelineExecution: { status: 'InProgress' } })
      .mockResolvedValueOnce({ pipelineExecution: { status: 'InProgress' } })
      .mockResolvedValueOnce({ pipelineExecution: { status: 'Succeeded' } });

    jest.useFakeTimers();
    const pending = handler(makeEvent());
    await jest.advanceTimersByTimeAsync(2_000);
    await pending;

    expect(mockCodePipelineSend).toHaveBeenCalledTimes(3);
    expect(publishedPayloads()).toEqual([
      expect.objectContaining({ phase: 'eventbridge', observedState: 'STARTED' }),
      expect.objectContaining({ phase: 'wait', observedState: 'INPROGRESS' }),
      expect.objectContaining({ phase: 'wait', observedState: 'SUCCEEDED' }),
    ]);
  });

  it('publishes a timeout note when the wait deadline elapses', async () => {
    mockCodePipelineSend.mockResolvedValue({
      pipelineExecution: { status: 'InProgress' },
    });

    jest.useFakeTimers();
    const pending = handler(makeEvent());
    await jest.advanceTimersByTimeAsync(61_000);
    await pending;

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
  });

  it('defaults observedState to STARTED when detail.state is absent', async () => {
    mockCodePipelineSend.mockResolvedValueOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await handler(makeEvent({
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
    mockCodePipelineSend.mockResolvedValueOnce({
      pipelineExecution: { status: 'Succeeded' },
    });

    await handler(makeEvent());

    expect(mockCodePipelineSend).toHaveBeenCalledTimes(1);
    expect(publishedPayloads()).toHaveLength(2);
  });

  it('publishes UNKNOWN on timeout when no execution status was observed', async () => {
    let nowCalls = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      nowCalls += 1;
      // First call builds the deadline; later calls skip the wait loop.
      return nowCalls === 1 ? 1_000_000 : 2_000_000;
    });

    await handler(makeEvent());

    expect(mockCodePipelineSend).not.toHaveBeenCalled();
    expect(publishedPayloads()).toEqual([
      expect.objectContaining({
        phase: 'eventbridge',
        observedState: 'STARTED',
      }),
      expect.objectContaining({
        phase: 'wait',
        observedState: 'UNKNOWN',
        note: 'Waiting timed out before terminal state.',
      }),
    ]);
  });
});
