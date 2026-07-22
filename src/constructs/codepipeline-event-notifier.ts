import { Duration, aws_events as events, aws_events_targets as targets, aws_iam as iam, aws_sns as sns } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NotifierFunction } from '../funcs/notifier-function';

/**
 * Properties for {@link CodePipelineEventNotifier}.
 */
export interface CodePipelineEventNotifierProps {
  /**
   * SNS topic that receives CodePipeline execution notifications.
   * Subscriptions (email/HTTP/etc.) are intentionally not managed by this construct.
   *
   * @default - a new topic is created
   */
  readonly topic?: sns.ITopic;

  /**
   * Interval between `GetPipelineExecution` waits.
   *
   * @default Duration.seconds(10)
   */
  readonly waitInterval?: Duration;

  /**
   * Maximum duration to wait for execution state changes.
   * Mapped to the notifier Lambda environment variable `MAX_WAIT_MINUTES`.
   *
   * @default Duration.minutes(14)
   */
  readonly maxWaitDuration?: Duration;

  /**
   * Timeout for the notifier Lambda function.
   * Should be greater than {@link maxWaitDuration}.
   *
   * @default Duration.minutes(15)
   */
  readonly timeout?: Duration;

  /**
   * EventBridge event pattern that triggers the notifier.
   *
   * @default CodePipeline Pipeline Execution State Change with `state=STARTED`
   */
  readonly eventPattern?: events.EventPattern;
}

/**
 * Provisions an EventBridge rule that listens for CodePipeline execution STARTED events,
 * then invokes a notifier Lambda which publishes execution state changes to an SNS topic.
 */
export class CodePipelineEventNotifier extends Construct {
  /**
   * SNS topic that receives CodePipeline execution notifications.
   */
  public readonly topic: sns.ITopic;

  /**
   * @param scope the construct scope
   * @param id the construct id
   * @param props construct properties
   */
  constructor(scope: Construct, id: string, props: CodePipelineEventNotifierProps = {}) {
    super(scope, id);

    this.topic = props.topic ?? new sns.Topic(this, 'PipelineEventTopic');

    const waitInterval = props.waitInterval ?? Duration.seconds(10);
    const maxWaitDuration = props.maxWaitDuration ?? Duration.minutes(14);
    const timeout = props.timeout ?? Duration.minutes(15);
    const eventPattern = props.eventPattern ?? {
      source: ['aws.codepipeline'],
      detailType: ['CodePipeline Pipeline Execution State Change'],
      detail: {
        state: ['STARTED'],
      },
    };

    const fn = new NotifierFunction(this, 'NotifierFunction', {
      environment: {
        SNS_TOPIC_ARN: this.topic.topicArn,
        WAIT_INTERVAL_SECONDS: String(waitInterval.toSeconds()),
        MAX_WAIT_MINUTES: String(maxWaitDuration.toMinutes({ integral: false })),
      },
      timeout,
    });

    // Allow the notifier to publish notifications.
    this.topic.grantPublish(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'codepipeline:GetPipelineExecution',
      ],
      resources: ['*'],
    }));

    // Trigger the notifier when matching CodePipeline execution events arrive.
    new events.Rule(this, 'OnPipelineExecutionStartedRule', {
      eventPattern,
      targets: [new targets.LambdaFunction(fn)],
    });
  }
}
