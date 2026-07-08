import { Duration, aws_events as events, aws_events_targets as targets, aws_iam as iam, aws_sns as sns } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NotifierFunction } from '../funcs/notifier-function';

/**
 * Provisions an EventBridge rule that listens for CodePipeline execution STARTED events,
 * then invokes a notifier Lambda which publishes execution state changes to an SNS topic.
 */
export class CodePipelineEventNotifier extends Construct {
  /**
   * @param scope the construct scope
   * @param id the construct id
   */
  constructor(scope: Construct, id: string) {
    super(scope, id);

    /**
     * SNS topic that receives CodePipeline execution notifications.
     * Subscriptions (email/HTTP/etc.) are intentionally not defined here.
     */
    const topic = new sns.Topic(this, 'PipelineEventTopic');

    const fn = new NotifierFunction(this, 'NotifierFunction', {
      environment: {
        SNS_TOPIC_ARN: topic.topicArn,
        POLL_INTERVAL_SECONDS: '10',
        MAX_POLL_MINUTES: '14',
      },
      timeout: Duration.minutes(15),
    });

    // Allow the notifier to publish notifications.
    topic.grantPublish(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'codepipeline:GetPipelineExecution',
      ],
      resources: ['*'],
    }));

    // Trigger the notifier when a pipeline execution enters STARTED.
    new events.Rule(this, 'OnPipelineExecutionStartedRule', {
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['STARTED'],
        },
      },
      targets: [new targets.LambdaFunction(fn)],
    });
  }
}