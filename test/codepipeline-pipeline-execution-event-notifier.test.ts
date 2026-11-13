import { App, Duration, Stack, aws_sns as sns } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CodePipelinePipelineExecutionEventNotifier, type CodePipelinePipelineExecutionEventNotifierProps } from '../src';
import { expectDurableNotifierWiring } from './expect-durable-notifier-wiring';

const defaultTargetPipeline = {
  tags: [
    {
      key: 'Notify',
      values: ['true'],
    },
  ],
};

describe('CodePipelinePipelineExecutionEventNotifier', () => {
  it('uses defaults when optional props are omitted', () => {
    const stack = new Stack(new App(), 'Defaults');
    new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      targetPipeline: defaultTargetPipeline,
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Topic', 1);
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
          TARGET_PIPELINE_TAGS: JSON.stringify(defaultTargetPipeline.tags),
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
  });

  it('reuses an existing topic and applies custom props', () => {
    const stack = new Stack(new App(), 'Custom');
    const topic = new sns.Topic(stack, 'ExistingTopic');

    new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      topic,
      waitInterval: Duration.seconds(30),
      maxWaitDuration: Duration.minutes(10),
      timeout: Duration.minutes(12),
      durableRetentionPeriod: Duration.days(7),
      targetPipeline: {
        tags: [
          {
            key: 'Team',
            values: ['platform', 'infra'],
          },
        ],
      },
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
    expectDurableNotifierWiring(template);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 720,
      DurableConfig: {
        ExecutionTimeout: 600,
        RetentionPeriodInDays: 7,
      },
      Environment: {
        Variables: Match.objectLike({
          WAIT_INTERVAL_SECONDS: '30',
          MAX_WAIT_MINUTES: '10',
          TARGET_PIPELINE_TAGS: JSON.stringify([
            { key: 'Team', values: ['platform', 'infra'] },
          ]),
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

  it('scopes IAM and Lambda allowlist to targetPipeline.arns', () => {
    const stack = new Stack(new App(), 'Arns');
    const pipelineArns = [
      'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
      'arn:aws:codepipeline:us-east-1:123456789012:other-pipeline',
    ];

    new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      targetPipeline: {
        tags: defaultTargetPipeline.tags,
        arns: pipelineArns,
      },
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          TARGET_PIPELINE_ARNS: JSON.stringify(pipelineArns),
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
            Resource: pipelineArns,
          }),
        ]),
      }),
    });
  });

  it.each([
    {
      name: 'empty tags',
      targetPipeline: { tags: [] },
    },
    {
      name: 'empty key',
      targetPipeline: { tags: [{ key: '', values: ['true'] }] },
    },
    {
      name: 'empty values',
      targetPipeline: { tags: [{ key: 'Notify', values: [] }] },
    },
    {
      name: 'empty value string',
      targetPipeline: { tags: [{ key: 'Notify', values: [''] }] },
    },
  ])('rejects $name', ({ targetPipeline }) => {
    const stack = new Stack(new App(), 'Invalid');

    expect(() => new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      targetPipeline,
    })).toThrow('targetPipeline.tags must be a non-empty array of { key, values }');
  });

  it('rejects duplicate tag keys', () => {
    const stack = new Stack(new App(), 'Duplicate');

    expect(() => new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      targetPipeline: {
        tags: [
          { key: 'Notify', values: ['true'] },
          { key: 'Notify', values: ['false'] },
        ],
      },
    })).toThrow('targetPipeline.tags contains duplicate key: Notify');
  });

  it.each([
    {
      name: 'empty arns',
      arns: [] as string[],
    },
    {
      name: 'empty ARN string',
      arns: [''],
    },
  ])('rejects $name', ({ arns }) => {
    const stack = new Stack(new App(), 'InvalidArns');

    expect(() => new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      targetPipeline: {
        tags: defaultTargetPipeline.tags,
        arns,
      },
    })).toThrow('targetPipeline.arns must be a non-empty array of ARNs');
  });

  it('rejects duplicate pipeline ARNs', () => {
    const stack = new Stack(new App(), 'DuplicateArns');
    const pipelineArn = 'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline';

    expect(() => new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      targetPipeline: {
        tags: defaultTargetPipeline.tags,
        arns: [pipelineArn, pipelineArn],
      },
    })).toThrow(`targetPipeline.arns contains duplicate ARN: ${pipelineArn}`);
  });

  it('trims tag keys and values before storing them', () => {
    const stack = new Stack(new App(), 'Trim');
    new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
      targetPipeline: {
        tags: [
          { key: ' Notify ', values: [' true '] },
        ],
        arns: [
          ' arn:aws:codepipeline:us-east-1:123456789012:my-pipeline ',
        ],
      },
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          TARGET_PIPELINE_TAGS: JSON.stringify([
            { key: 'Notify', values: ['true'] },
          ]),
          TARGET_PIPELINE_ARNS: JSON.stringify([
            'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
          ]),
        }),
      },
    });
  });

  describe('failure detection', () => {
    it('creates no alarms when failure detection is omitted', () => {
      const stack = new Stack(new App(), 'NoFailureDetection');
      new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
        targetPipeline: defaultTargetPipeline,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
      template.resourceCountIs('AWS::Logs::MetricFilter', 0);
    });

    it('alarms on Lambda errors, throttles, and the wait-timeout log without an alarm topic', () => {
      const stack = new Stack(new App(), 'FailureDetection');
      new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
        targetPipeline: defaultTargetPipeline,
        failureDetection: {
          enabled: true,
        },
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
      template.resourceCountIs('AWS::Logs::MetricFilter', 1);
      template.hasResourceProperties('AWS::Logs::MetricFilter', {
        FilterPattern: '"PipelineExecutionWaitTimedOut"',
        MetricTransformations: [
          Match.objectLike({
            MetricNamespace: 'CodePipelinePipelineExecutionEventNotifier',
            MetricName: 'PipelineExecutionWaitTimedOut',
          }),
        ],
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'AWS/Lambda',
        MetricName: 'Errors',
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'AWS/Lambda',
        MetricName: 'Throttles',
      });
      const alarms = template.findResources('AWS::CloudWatch::Alarm');
      for (const alarm of Object.values(alarms)) {
        expect(alarm.Properties.AlarmActions).toBeUndefined();
      }
    });

    it('notifies the caller topic when alarmTopic is set', () => {
      const stack = new Stack(new App(), 'FailureDetectionTopic');
      const alarmTopic = new sns.Topic(stack, 'AlarmTopic');
      new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', {
        targetPipeline: defaultTargetPipeline,
        failureDetection: {
          enabled: true,
          alarmTopic,
        },
      });

      const template = Template.fromStack(stack);
      const topicLogicalId = Object.keys(template.findResources('AWS::SNS::Topic')).find((id) => id.startsWith('AlarmTopic'));
      expect(topicLogicalId).toBeDefined();
      const alarms = template.findResources('AWS::CloudWatch::Alarm');
      expect(Object.keys(alarms)).toHaveLength(3);
      for (const alarm of Object.values(alarms)) {
        expect(alarm.Properties.AlarmActions).toEqual([{ Ref: topicLogicalId }]);
      }
    });
  });

  describe('template snapshots for major props combinations', () => {
    it.each([
      {
        name: 'defaults',
        buildProps: (): CodePipelinePipelineExecutionEventNotifierProps => ({
          targetPipeline: defaultTargetPipeline,
        }),
      },
      {
        name: 'custom-timing',
        buildProps: (): CodePipelinePipelineExecutionEventNotifierProps => ({
          targetPipeline: defaultTargetPipeline,
          waitInterval: Duration.seconds(30),
          maxWaitDuration: Duration.minutes(10),
          timeout: Duration.minutes(3),
          durableRetentionPeriod: Duration.days(7),
        }),
      },
      {
        name: 'existing-topic-and-pattern',
        buildProps: (stack: Stack): CodePipelinePipelineExecutionEventNotifierProps => ({
          topic: new sns.Topic(stack, 'ExistingTopic'),
          targetPipeline: {
            tags: [
              { key: 'Team', values: ['platform', 'infra'] },
            ],
          },
          eventPattern: {
            source: ['aws.codepipeline'],
            detailType: ['CodePipeline Pipeline Execution State Change'],
            detail: {
              state: ['STARTED'],
              pipeline: ['my-pipeline'],
            },
          },
        }),
      },
      {
        name: 'failure-detection',
        buildProps: (stack: Stack): CodePipelinePipelineExecutionEventNotifierProps => ({
          targetPipeline: defaultTargetPipeline,
          failureDetection: {
            enabled: true,
            alarmTopic: new sns.Topic(stack, 'AlarmTopic'),
          },
        }),
      },
      {
        name: 'arns-allowlist',
        buildProps: (): CodePipelinePipelineExecutionEventNotifierProps => ({
          targetPipeline: {
            tags: defaultTargetPipeline.tags,
            arns: [
              'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
            ],
          },
        }),
      },
    ])('matches snapshot for $name', ({ name, buildProps }) => {
      const stack = new Stack(new App(), `Snap-${name}`);
      new CodePipelinePipelineExecutionEventNotifier(stack, 'Notifier', buildProps(stack));

      expect(Template.fromStack(stack).toJSON()).toMatchSnapshot(name);
    });
  });
});
