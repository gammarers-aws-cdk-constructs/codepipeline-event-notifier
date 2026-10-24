import {
  hasMoreWaitAttempts,
  isTerminalExecutionStatus,
  normalizeExecutionStatus,
  resolveMaxAttempts,
  resolvePipelineExecutionIdentity,
} from '../src/funcs/core/notifier-predicates';

describe('normalizeExecutionStatus', () => {
  it.each([
    { statusRaw: undefined, expected: 'UNKNOWN' },
    { statusRaw: 'Succeeded', expected: 'SUCCEEDED' },
    { statusRaw: 'failed', expected: 'FAILED' },
    { statusRaw: 'InProgress', expected: 'INPROGRESS' },
  ])('normalizes $statusRaw to $expected', ({ statusRaw, expected }) => {
    expect(normalizeExecutionStatus(statusRaw)).toBe(expected);
  });
});

describe('isTerminalExecutionStatus', () => {
  it.each([
    { status: 'SUCCEEDED', expected: true },
    { status: 'FAILED', expected: true },
    { status: 'STOPPED', expected: true },
    { status: 'SUPERSEDED', expected: true },
    { status: 'INPROGRESS', expected: false },
    { status: 'STARTED', expected: false },
    { status: 'UNKNOWN', expected: false },
  ])('returns $expected for $status', ({ status, expected }) => {
    expect(isTerminalExecutionStatus(status)).toBe(expected);
  });
});

describe('resolveMaxAttempts', () => {
  it.each([
    { waitIntervalSeconds: 10, maxWaitMinutes: 14, expected: 84 },
    { waitIntervalSeconds: 30, maxWaitMinutes: 1, expected: 2 },
    { waitIntervalSeconds: 60, maxWaitMinutes: 1, expected: 1 },
    { waitIntervalSeconds: 120, maxWaitMinutes: 1, expected: 1 },
  ])('returns $expected for interval=$waitIntervalSeconds max=$maxWaitMinutes', ({
    waitIntervalSeconds,
    maxWaitMinutes,
    expected,
  }) => {
    expect(resolveMaxAttempts(waitIntervalSeconds, maxWaitMinutes)).toBe(expected);
  });
});

describe('hasMoreWaitAttempts', () => {
  it.each([
    { attempt: 0, maxAttempts: 2, expected: true },
    { attempt: 1, maxAttempts: 2, expected: false },
    { attempt: 0, maxAttempts: 1, expected: false },
  ])('returns $expected for attempt=$attempt maxAttempts=$maxAttempts', ({
    attempt,
    maxAttempts,
    expected,
  }) => {
    expect(hasMoreWaitAttempts(attempt, maxAttempts)).toBe(expected);
  });
});

describe('resolvePipelineExecutionIdentity', () => {
  it.each([
    {
      pipelineName: 'pipe',
      executionId: 'exec-1',
      expected: { pipelineName: 'pipe', executionId: 'exec-1' },
    },
    { pipelineName: undefined, executionId: 'exec-1', expected: undefined },
    { pipelineName: 'pipe', executionId: undefined, expected: undefined },
    { pipelineName: '', executionId: 'exec-1', expected: undefined },
    { pipelineName: 'pipe', executionId: '', expected: undefined },
  ])('resolves pipeline=$pipelineName executionId=$executionId', ({
    pipelineName,
    executionId,
    expected,
  }) => {
    expect(resolvePipelineExecutionIdentity(pipelineName, executionId)).toEqual(expected);
  });
});
