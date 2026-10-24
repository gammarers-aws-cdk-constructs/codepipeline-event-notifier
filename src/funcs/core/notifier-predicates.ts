/**
 * Pipeline and execution identifiers required to wait on a CodePipeline execution.
 */
export interface PipelineExecutionIdentity {
  readonly pipelineName: string;
  readonly executionId: string;
}

/**
 * Normalizes a raw CodePipeline execution status for comparison.
 *
 * @param statusRaw the status returned by GetPipelineExecution
 * @returns upper-cased status, or `UNKNOWN` when missing
 */
export const normalizeExecutionStatus = (statusRaw: string | undefined): string =>
  String(statusRaw ?? 'UNKNOWN').toUpperCase();

/**
 * Returns whether a normalized CodePipeline execution status is terminal.
 *
 * @param status normalized execution status
 * @returns true when waiting should stop
 */
export const isTerminalExecutionStatus = (status: string): boolean => (
  status === 'SUCCEEDED'
  || status === 'FAILED'
  || status === 'STOPPED'
  || status === 'SUPERSEDED'
);

/**
 * Resolves how many GetPipelineExecution attempts fit into the max wait window.
 *
 * @param waitIntervalSeconds interval between checks
 * @param maxWaitMinutes maximum wait duration
 * @returns at least one attempt
 */
export const resolveMaxAttempts = (waitIntervalSeconds: number, maxWaitMinutes: number): number =>
  Math.max(1, Math.ceil((maxWaitMinutes * 60) / waitIntervalSeconds));

/**
 * Returns whether another wait interval should run after the current attempt.
 *
 * @param attempt zero-based attempt index that just finished
 * @param maxAttempts total attempts allowed
 * @returns true when a subsequent GetPipelineExecution check should run
 */
export const hasMoreWaitAttempts = (attempt: number, maxAttempts: number): boolean =>
  attempt + 1 < maxAttempts;

/**
 * Resolves pipeline/execution identifiers from EventBridge detail fields.
 *
 * @param pipelineName pipeline name from the event detail
 * @param executionId execution id from the event detail
 * @returns identifiers when both are present; otherwise undefined
 */
export const resolvePipelineExecutionIdentity = (
  pipelineName: string | undefined,
  executionId: string | undefined,
): PipelineExecutionIdentity | undefined => {
  if (!pipelineName || !executionId) {
    return undefined;
  }
  return { pipelineName, executionId };
};
