import { ProjenCdkConstructLibrary } from '@gammarers/projen-projects';
import { awscdk } from 'projen';
const project = new ProjenCdkConstructLibrary({
  projenrcTs: true,
  releaseToNpm: true,
  npmTrustedPublishing: true,
  cdkVersion: '2.232.0',
  name: 'codepipeline-event-notifier',
  repository: 'https://github.com/gammarers-aws-cdk-constructs/codepipeline-event-notifier.git',
  description: 'CDK construct that listens to AWS CodePipeline execution STARTED events via EventBridge, invokes a Lambda notifier, and publishes execution state changes to an SNS topic.',
  devDeps: [
    '@gammarers/projen-projects@^0.2.4',
    '@types/aws-lambda@^8.10.162',
    '@aws-sdk/client-codepipeline@^3.1080.0',
    '@aws-sdk/client-sns@^3.1080.0',
    'strict-env-resolver@^0.5.1',
  ],
  jestOptions: {
    extraCliOptions: ['--silent'],
  },
  tsconfigDev: {
    compilerOptions: {
      strict: true,
      // Required by ts-jest when the base tsconfig uses "module": "node16"
      isolatedModules: true,
    },
  },
  lambdaOptions: {
    // target node.js runtime
    runtime: awscdk.LambdaRuntime.NODEJS_24_X,
    bundlingOptions: {
      // list of node modules to exclude from the bundle
      externals: ['@aws-sdk/*'],
      sourcemap: true,
    },
  },
});
project.addPackageIgnore('/.devcontainer');
project.synth();