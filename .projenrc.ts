import { ProjenCdkConstructLibrary } from '@gammarers/projen-projects';
const project = new ProjenCdkConstructLibrary({
  projenrcTs: true,
  releaseToNpm: true,
  npmTrustedPublishing: true,
  cdkVersion: '2.232.0',
  name: 'codepipeline-event-notifier',
  repositoryUrl: 'https://github.com/gammarers-aws-cdk-constructs/codepipeline-event-notifier.git',
  description: 'CDK construct that listens to AWS CodePipeline execution STARTED events via EventBridge, invokes a durable Lambda notifier, and publishes execution state changes to an SNS topic.',
  devDeps: [
    '@gammarers/projen-projects@^0.5.10',
    '@types/aws-lambda@^8.10.162',
    '@aws-sdk/client-codepipeline@^3.1080.0',
    '@aws-sdk/client-sns@^3.1080.0',
    '@aws/durable-execution-sdk-js@^2.7.1',
    '@aws/durable-execution-sdk-js-testing@^1.3.1',
    'strict-env-resolver@^0.8.1',
  ],
  jestOptions: {
    jestConfig: {
      coverageThreshold: {
        branches: 95,
        functions: 90,
        lines: 100,
        statements: 100,
      },
    },
  },
});
project.synth();