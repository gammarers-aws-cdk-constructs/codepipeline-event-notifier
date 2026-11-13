import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CodePipelinePipelineExecutionEventNotifier,
  type CodePipelinePipelineExecutionEventNotifierProps,
} from './codepipeline-pipeline-execution-event-notifier';

/**
 * Properties for {@link CodePipelineEventNotifyStack}.
 */
export interface CodePipelineEventNotifyStackProps extends CodePipelinePipelineExecutionEventNotifierProps, StackProps {}

/**
 * Example stack wiring up {@link CodePipelinePipelineExecutionEventNotifier}.
 */
export class CodePipelineEventNotifyStack extends Stack {
  /**
   * @param scope the app scope
   * @param id the stack id
   * @param props stack and notifier properties
   */
  constructor(scope: Construct, id: string, props: CodePipelineEventNotifyStackProps) {
    super(scope, id, props);

    new CodePipelinePipelineExecutionEventNotifier(this, 'CodePipelinePipelineExecutionEventNotifier', {
      targetPipeline: props.targetPipeline,
      topic: props.topic,
      waitInterval: props.waitInterval,
      maxWaitDuration: props.maxWaitDuration,
      timeout: props.timeout,
      durableRetentionPeriod: props.durableRetentionPeriod,
      eventPattern: props.eventPattern,
      failureDetection: props.failureDetection,
    });
  }
}
