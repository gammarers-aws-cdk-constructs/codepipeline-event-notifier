/**
 * Shared environment variable and default values used by the construct and notifier Lambda.
 */

/**
 * SNS topic ARN environment variable name.
 */
export const ENV_SNS_TOPIC_ARN = 'SNS_TOPIC_ARN';

/**
 * Wait interval (seconds) environment variable name.
 */
export const ENV_WAIT_INTERVAL_SECONDS = 'WAIT_INTERVAL_SECONDS';

/**
 * Maximum wait duration (minutes) environment variable name.
 */
export const ENV_MAX_WAIT_MINUTES = 'MAX_WAIT_MINUTES';

/**
 * Target pipeline tag filters environment variable name.
 */
export const ENV_TARGET_PIPELINE_TAGS = 'TARGET_PIPELINE_TAGS';

/**
 * Optional pipeline ARN allowlist environment variable name.
 */
export const ENV_TARGET_PIPELINE_ARNS = 'TARGET_PIPELINE_ARNS';

/**
 * Default interval between GetPipelineExecution checks, in seconds.
 */
export const DEFAULT_WAIT_INTERVAL_SECONDS = 10;

/**
 * Default maximum wait duration for a pipeline execution, in minutes.
 */
export const DEFAULT_MAX_WAIT_MINUTES = 14;
