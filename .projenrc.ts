import { ProjenCdkConstructLibrary } from '@gammarers/projen-projects';
const project = new ProjenCdkConstructLibrary({
  projenrcTs: true,
  releaseToNpm: true,
  npmTrustedPublishing: false,
  cdkVersion: '2.232.0',
  name: 'codepipeline-pipeline-execution-event-notifier',
  repositoryUrl: 'https://github.com/gammarers-aws-cdk-constructs/codepipeline-pipeline-execution-event-notifier.git',
  description: 'CDK construct that listens to AWS CodePipeline execution STARTED events via EventBridge, invokes a durable Lambda notifier, and publishes execution state changes to an SNS topic.',
  peerDeps: [
    'construct-resource-criteria@^0.2.0',
    'lambda-failure-detector@^0.2.3',
  ],
  devDeps: [
    '@gammarers/projen-projects@^0.5.10',
    '@types/aws-lambda@^8.10.162',
    '@aws-sdk/client-codepipeline@^3.1080.0',
    '@aws-sdk/client-sns@^3.1080.0',
    '@smithy/node-http-handler@^4.14.1',
    'aws-sdk-client-mock@^4.1.0',
    'aws-sdk-client-mock-jest@^4.1.0',
    '@aws/durable-execution-sdk-js@^2.7.1',
    '@aws/durable-execution-sdk-js-testing@^1.3.1',
    'strict-env-resolver@^0.8.1',
  ],
});
project.synth();