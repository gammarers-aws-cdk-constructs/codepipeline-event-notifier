import {
  isTerminalExecutionStatus,
  normalizeExecutionStatus,
  resolvePipelineExecutionIdentity,
} from '../src/funcs/notifier-predicates';

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
