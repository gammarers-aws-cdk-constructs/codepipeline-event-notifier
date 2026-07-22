import { App, Duration, Stack, aws_sns as sns } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CodePipelineEventNotifier } from '../src';

describe('CodePipelineEventNotifier', () => {
  it('uses defaults when props are omitted', () => {
    const stack = new Stack(new App(), 'Defaults');
    new CodePipelineEventNotifier(stack, 'Notifier');

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 900,
      Environment: {
        Variables: Match.objectLike({
          WAIT_INTERVAL_SECONDS: '10',
          MAX_WAIT_MINUTES: '14',
        }),
      },
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
  });

  it('reuses an existing topic and applies custom props', () => {
    const stack = new Stack(new App(), 'Custom');
    const topic = new sns.Topic(stack, 'ExistingTopic');

    new CodePipelineEventNotifier(stack, 'Notifier', {
      topic,
      waitInterval: Duration.seconds(30),
      maxWaitDuration: Duration.minutes(10),
      timeout: Duration.minutes(12),
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['STARTED'],
          pipeline: ['my-pipeline'],
        },
      },
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 720,
      Environment: {
        Variables: Match.objectLike({
          WAIT_INTERVAL_SECONDS: '30',
          MAX_WAIT_MINUTES: '10',
        }),
      },
    });
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        'source': ['aws.codepipeline'],
        'detail-type': ['CodePipeline Pipeline Execution State Change'],
        'detail': {
          state: ['STARTED'],
          pipeline: ['my-pipeline'],
        },
      },
    });
  });
});
