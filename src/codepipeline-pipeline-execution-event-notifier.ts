import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Rule, type EventPattern } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Topic, type ITopic } from 'aws-cdk-lib/aws-sns';
import {
  ConstructResourceCriteria,
  type ConstructResourceTagCriteria,
} from 'construct-resource-criteria';
import { Construct } from 'constructs';
import {
  createLambdaFailureDetector,
  type LambdaFailureDetection,
  type LogFailureFilter,
} from 'lambda-failure-detector';
import { NotifierFunction } from './funcs/notifier-function';
import {
  DEFAULT_MAX_WAIT_MINUTES,
  DEFAULT_WAIT_INTERVAL_SECONDS,
  ENV_MAX_WAIT_MINUTES,
  ENV_SNS_TOPIC_ARN,
  ENV_TARGET_PIPELINE_ARNS,
  ENV_TARGET_PIPELINE_TAGS,
  ENV_WAIT_INTERVAL_SECONDS,
  PIPELINE_EXECUTION_WAIT_TIMED_OUT_EVENT,
} from './settings/consts';

/**
 * Default timeout for a single notifier Lambda invocation, in minutes.
 */
const DEFAULT_LAMBDA_TIMEOUT_MINUTES = 5;

/**
 * Default durable execution history retention, in days.
 */
const DEFAULT_DURABLE_RETENTION_DAYS = 14;

/**
 * Alias name used as the EventBridge target (durable execution requires a qualified ARN).
 */
const NOTIFIER_ALIAS_NAME = 'live';

/**
 * CloudWatch Logs retention for the notifier Lambda.
 * Kept after a successful create so a deleted or replaced stack can still be investigated.
 */
const NOTIFIER_LOG_RETENTION = RetentionDays.ONE_MONTH;

/**
 * Custom metric namespace for notifier log alarms.
 */
const NOTIFIER_FAILURE_METRIC_NAMESPACE = 'CodePipelinePipelineExecutionEventNotifier';

/**
 * Log metric filters for business failures that do not increment Lambda `Errors`.
 */
const NOTIFIER_LOG_FAILURE_FILTERS: LogFailureFilter[] = [
  {
    id: PIPELINE_EXECUTION_WAIT_TIMED_OUT_EVENT,
    filterPattern: `"${PIPELINE_EXECUTION_WAIT_TIMED_OUT_EVENT}"`,
    metricNamespace: NOTIFIER_FAILURE_METRIC_NAMESPACE,
    metricName: PIPELINE_EXECUTION_WAIT_TIMED_OUT_EVENT,
  },
];

/**
 * Selection criteria for pipelines that should trigger notifications.
 */
export interface TargetPipeline {
  /**
   * Tag criteria applied to CodePipeline resources.
   * Entries are AND; {@link ConstructResourceTagCriteria.tagValues} within an entry are OR.
   */
  readonly tags: ConstructResourceTagCriteria[];

  /**
   * Pipeline ARNs used as IAM resources for `GetPipelineExecution` and `ListTagsForResource`.
   * When set, the notifier also ignores STARTED events whose pipeline ARN is not in this list.
   *
   * @default all CodePipeline resources in this account and region
   */
  readonly arns?: string[];
}

/**
 * Opt-in CloudWatch alarms for {@link CodePipelinePipelineExecutionEventNotifier}.
 * Alarms are created only when `enabled` is true.
 * This construct does not create an SNS topic for those alarms.
 */
export interface CodePipelinePipelineExecutionEventNotifierFailureDetectionProps extends LambdaFailureDetection {}

/**
 * Properties for {@link CodePipelinePipelineExecutionEventNotifier}.
 */
export interface CodePipelinePipelineExecutionEventNotifierProps {
  /**
   * Pipelines that should produce notifications, selected by resource tags.
   */
  readonly targetPipeline: TargetPipeline;

  /**
   * SNS topic that receives CodePipeline execution notifications.
   * Subscriptions (email/HTTP/etc.) are intentionally not managed by this construct.
   *
   * @default - a new topic is created
   */
  readonly topic?: ITopic;

  /**
   * Interval between durable waits around `GetPipelineExecution` checks.
   *
   * @default Duration.seconds(10)
   */
  readonly waitInterval?: Duration;

  /**
   * Maximum duration to wait for execution state changes.
   * Mapped to the notifier Lambda environment variable `MAX_WAIT_MINUTES`
   * and to the durable function `executionTimeout`.
   *
   * @default Duration.minutes(14)
   */
  readonly maxWaitDuration?: Duration;

  /**
   * Timeout for a single notifier Lambda invocation.
   * Durable waits suspend between invocations, so this need not cover {@link maxWaitDuration}.
   *
   * @default Duration.minutes(5)
   */
  readonly timeout?: Duration;

  /**
   * How long Lambda retains durable execution history after the execution closes.
   *
   * @default Duration.days(14)
   */
  readonly durableRetentionPeriod?: Duration;

  /**
   * EventBridge event pattern that triggers the notifier.
   *
   * @default CodePipeline Pipeline Execution State Change with `state=STARTED`
   */
  readonly eventPattern?: EventPattern;

  /**
   * Opt-in CloudWatch alarms for Lambda `Errors`, `Throttles`, and a wait-timeout log.
   * Pass an existing topic as `alarmTopic` when the alarms should notify.
   *
   * @default failure detection is omitted and no alarms are created
   */
  readonly failureDetection?: CodePipelinePipelineExecutionEventNotifierFailureDetectionProps;
}

/**
 * Validates {@link TargetPipeline} tag criteria.
 *
 * @param tags tag criteria from construct props
 * @returns a copy of the validated criteria
 */
const resolveTargetPipelineTags = (tags: readonly ConstructResourceTagCriteria[]): ConstructResourceTagCriteria[] => {
  if (tags.length === 0) {
    throw new Error('targetPipeline.tags must contain at least one value.');
  }

  const seenKeys = new Set<string>();
  const normalized: ConstructResourceTagCriteria[] = [];

  for (const [index, criteria] of tags.entries()) {
    const propPath = `targetPipeline.tags[${index}]`;
    ConstructResourceCriteria.assertTagCriteria(criteria, { propPath });
    if (seenKeys.has(criteria.tagKey)) {
      throw new Error(`targetPipeline.tags contains duplicate tagKey: ${criteria.tagKey}`);
    }
    seenKeys.add(criteria.tagKey);
    normalized.push({
      tagKey: criteria.tagKey,
      tagValues: [...criteria.tagValues],
    });
  }

  return normalized;
};

/**
 * Validates optional pipeline ARNs used for IAM and runtime allowlisting.
 *
 * @param arns pipeline ARNs from construct props
 * @returns normalized ARNs, or undefined when omitted
 */
const resolveTargetPipelineArns = (arns: string[] | undefined): string[] | undefined => {
  if (arns === undefined) {
    return undefined;
  }
  if (arns.length === 0) {
    throw new Error('targetPipeline.arns must be a non-empty array of ARNs');
  }

  const seenArns = new Set<string>();
  const normalized: string[] = [];

  for (const rawArn of arns) {
    const arn = rawArn.trim();
    if (!arn) {
      throw new Error('targetPipeline.arns must be a non-empty array of ARNs');
    }
    if (seenArns.has(arn)) {
      throw new Error(`targetPipeline.arns contains duplicate ARN: ${arn}`);
    }
    seenArns.add(arn);
    normalized.push(arn);
  }

  return normalized;
};

/**
 * Provisions an EventBridge rule that listens for CodePipeline execution STARTED events,
 * then invokes a durable notifier Lambda which publishes execution state changes to an SNS topic.
 */
export class CodePipelinePipelineExecutionEventNotifier extends Construct {
  /**
   * SNS topic that receives CodePipeline execution notifications.
   */
  public readonly topic: ITopic;

  /**
   * @param scope the construct scope
   * @param id the construct id
   * @param props construct properties
   */
  constructor(scope: Construct, id: string, props: CodePipelinePipelineExecutionEventNotifierProps) {
    super(scope, id);

    const targetPipelineTags = resolveTargetPipelineTags(props.targetPipeline.tags);
    const targetPipelineArns = resolveTargetPipelineArns(props.targetPipeline.arns);
    const pipelineIamResources = targetPipelineArns ?? [
      Stack.of(this).formatArn({
        service: 'codepipeline',
        resource: '*',
      }),
    ];

    this.topic = props.topic ?? new Topic(this, 'PipelineEventTopic');

    const waitInterval = props.waitInterval ?? Duration.seconds(DEFAULT_WAIT_INTERVAL_SECONDS);
    const maxWaitDuration = props.maxWaitDuration ?? Duration.minutes(DEFAULT_MAX_WAIT_MINUTES);
    const timeout = props.timeout ?? Duration.minutes(DEFAULT_LAMBDA_TIMEOUT_MINUTES);
    const durableRetentionPeriod = props.durableRetentionPeriod ?? Duration.days(DEFAULT_DURABLE_RETENTION_DAYS);
    const eventPattern = props.eventPattern ?? {
      source: ['aws.codepipeline'],
      detailType: ['CodePipeline Pipeline Execution State Change'],
      detail: {
        state: ['STARTED'],
      },
    };

    // A failed first create still deletes the group. After a successful create, stack deletion or replacement keeps the logs.
    const logGroup = new LogGroup(this, 'NotifierLogGroup', {
      retention: NOTIFIER_LOG_RETENTION,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    });

    const fn = new NotifierFunction(this, 'NotifierFunction', {
      logGroup,
      environment: {
        [ENV_SNS_TOPIC_ARN]: this.topic.topicArn,
        [ENV_WAIT_INTERVAL_SECONDS]: String(waitInterval.toSeconds()),
        [ENV_MAX_WAIT_MINUTES]: String(maxWaitDuration.toMinutes({ integral: false })),
        [ENV_TARGET_PIPELINE_TAGS]: JSON.stringify(targetPipelineTags),
        ...(targetPipelineArns ? { [ENV_TARGET_PIPELINE_ARNS]: JSON.stringify(targetPipelineArns) } : {}),
      },
      timeout,
      durableConfig: {
        executionTimeout: maxWaitDuration,
        retentionPeriod: durableRetentionPeriod,
      },
    });

    // Durable execution requires a qualified ARN (version or alias).
    const liveAlias = fn.addAlias(NOTIFIER_ALIAS_NAME);

    // Alarms use the caller's topic. The wait-timeout log does not increment Lambda Errors.
    createLambdaFailureDetector(this, 'FailureDetector', {
      failureDetection: props.failureDetection,
      lambdaFunction: fn,
      logGroup,
      logFilters: NOTIFIER_LOG_FAILURE_FILTERS,
    });

    // Allow the notifier to publish notifications and look up pipeline tags.
    this.topic.grantPublish(fn);
    fn.addToRolePolicy(new PolicyStatement({
      actions: [
        'codepipeline:GetPipelineExecution',
        'codepipeline:ListTagsForResource',
      ],
      resources: pipelineIamResources,
    }));

    // Trigger the durable notifier when matching CodePipeline execution events arrive.
    new Rule(this, 'OnPipelineExecutionStartedRule', {
      eventPattern,
      targets: [new LambdaFunction(liveAlias)],
    });
  }
}
