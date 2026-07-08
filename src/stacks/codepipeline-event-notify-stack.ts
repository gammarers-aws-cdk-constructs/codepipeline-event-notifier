import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipelineEventNotifier } from '../constructs/codepipeline-event-notifier';

/**
 * Example stack wiring up {@link CodePipelineEventNotifier}.
 */
export class CodePipelineEventNotifyStack extends Stack {
  /**
   * @param scope the app scope
   * @param id the stack id
   */
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new CodePipelineEventNotifier(this, 'CodePipelineEventNotifier');
  }
}