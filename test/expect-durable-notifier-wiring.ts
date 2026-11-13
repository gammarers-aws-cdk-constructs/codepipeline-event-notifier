import { Match, Template } from 'aws-cdk-lib/assertions';

/**
 * Asserts durable execution wiring shared by the notifier construct and the example stack.
 */
export const expectDurableNotifierWiring = (template: Template): void => {
  template.resourceCountIs('AWS::Lambda::Function', 1);
  template.resourceCountIs('AWS::Lambda::Version', 1);
  template.resourceCountIs('AWS::Lambda::Alias', 1);
  template.resourceCountIs('AWS::Lambda::Permission', 1);
  template.resourceCountIs('AWS::Events::Rule', 1);
  template.resourceCountIs('AWS::Logs::LogGroup', 1);

  template.hasResource('AWS::Logs::LogGroup', {
    DeletionPolicy: 'RetainExceptOnCreate',
    UpdateReplacePolicy: 'Retain',
    Properties: Match.objectLike({
      RetentionInDays: 30,
    }),
  });

  const logGroupLogicalId = Object.keys(template.findResources('AWS::Logs::LogGroup'))[0];
  template.hasResourceProperties('AWS::Lambda::Function', {
    LoggingConfig: {
      LogGroup: { Ref: logGroupLogicalId },
    },
  });

  template.hasResourceProperties('AWS::Lambda::Alias', {
    Name: 'live',
  });

  template.hasResourceProperties('AWS::IAM::Role', {
    ManagedPolicyArns: Match.arrayWith([
      {
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':iam::aws:policy/service-role/AWSLambdaBasicDurableExecutionRolePolicy',
          ],
        ],
      },
    ]),
  });

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'sns:Publish',
          Effect: 'Allow',
        }),
      ]),
    }),
  });

  const aliasLogicalId = Object.keys(template.findResources('AWS::Lambda::Alias'))[0];
  template.hasResourceProperties('AWS::Events::Rule', {
    Targets: [
      {
        Arn: { Ref: aliasLogicalId },
        Id: 'Target0',
      },
    ],
  });
};
