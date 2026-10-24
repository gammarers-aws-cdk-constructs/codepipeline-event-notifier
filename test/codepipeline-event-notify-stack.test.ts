import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodePipelineEventNotifyStack } from '../src/codepipeline-event-notify-stack';

describe('CodePipelineEventNotifyStack', () => {
  it('matches snapshot', () => {
    const app = new App();
    const stack = new CodePipelineEventNotifyStack(app, 'TestStack', {
      targetPipeline: {
        tags: [
          {
            key: 'Notify',
            values: ['true'],
          },
        ],
      },
    });

    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
