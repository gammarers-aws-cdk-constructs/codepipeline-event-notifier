import { App, Duration, Stack, aws_sns as sns } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CodePipelineEventNotifier } from '../src';

const defaultTargetPipeline = {
  tags: [
    {
      key: 'Notify',
      values: ['true'],
    },
  ],
};

describe('CodePipelineEventNotifier', () => {
  it('uses defaults when optional props are omitted', () => {
    const stack = new Stack(new App(), 'Defaults');
    new CodePipelineEventNotifier(stack, 'Notifier', {
      targetPipeline: defaultTargetPipeline,
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 900,
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

    new CodePipelineEventNotifier(stack, 'Notifier', {
      topic,
      waitInterval: Duration.seconds(30),
      maxWaitDuration: Duration.minutes(10),
      timeout: Duration.minutes(12),
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
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 720,
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

    new CodePipelineEventNotifier(stack, 'Notifier', {
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

    expect(() => new CodePipelineEventNotifier(stack, 'Notifier', {
      targetPipeline,
    })).toThrow('targetPipeline.tags must be a non-empty array of { key, values }');
  });

  it('rejects duplicate tag keys', () => {
    const stack = new Stack(new App(), 'Duplicate');

    expect(() => new CodePipelineEventNotifier(stack, 'Notifier', {
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

    expect(() => new CodePipelineEventNotifier(stack, 'Notifier', {
      targetPipeline: {
        tags: defaultTargetPipeline.tags,
        arns,
      },
    })).toThrow('targetPipeline.arns must be a non-empty array of ARNs');
  });

  it('rejects duplicate pipeline ARNs', () => {
    const stack = new Stack(new App(), 'DuplicateArns');
    const pipelineArn = 'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline';

    expect(() => new CodePipelineEventNotifier(stack, 'Notifier', {
      targetPipeline: {
        tags: defaultTargetPipeline.tags,
        arns: [pipelineArn, pipelineArn],
      },
    })).toThrow(`targetPipeline.arns contains duplicate ARN: ${pipelineArn}`);
  });

  it('trims tag keys and values before storing them', () => {
    const stack = new Stack(new App(), 'Trim');
    new CodePipelineEventNotifier(stack, 'Notifier', {
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
});
