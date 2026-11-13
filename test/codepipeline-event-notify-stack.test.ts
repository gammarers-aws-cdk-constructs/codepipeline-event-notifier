import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { expectDurableNotifierWiring } from './expect-durable-notifier-wiring';
import { CodePipelineEventNotifyStack } from '../src/codepipeline-event-notify-stack';

const targetPipeline = {
  tags: [
    {
      key: 'Notify',
      values: ['true'],
    },
  ],
};

describe('CodePipelineEventNotifyStack', () => {
  it('deploys the notifier with default durable wiring', () => {
    const app = new App();
    const stack = new CodePipelineEventNotifyStack(app, 'TestStack', {
      targetPipeline,
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
    template.resourceCountIs('AWS::Logs::MetricFilter', 0);
    expectDurableNotifierWiring(template);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 300,
      DurableConfig: {
        ExecutionTimeout: 840,
        RetentionPeriodInDays: 14,
      },
      Environment: {
        Variables: Match.objectLike({
          WAIT_INTERVAL_SECONDS: '10',
          MAX_WAIT_MINUTES: '14',
          TARGET_PIPELINE_TAGS: JSON.stringify(targetPipeline.tags),
        }),
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: [
              'codepipeline:GetPipelineExecution',
              'codepipeline:ListTagsForResource',
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':codepipeline:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':*',
                ],
              ],
            },
          }),
        ]),
      }),
    });
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        'source': ['aws.codepipeline'],
        'detail-type': ['CodePipeline Pipeline Execution State Change'],
        'detail': {
          state: ['STARTED'],
        },
      },
    });

    expect(template.toJSON()).toMatchSnapshot();
  });
});
