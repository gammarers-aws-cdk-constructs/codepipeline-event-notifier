# CodePipeline Event Notifier (CDK v2)

[![npm version](https://img.shields.io/npm/v/codepipeline-event-notifier?style=flat-square)](https://www.npmjs.com/package/codepipeline-event-notifier)
[![license](https://img.shields.io/npm/l/codepipeline-event-notifier?style=flat-square)](https://www.npmjs.com/package/codepipeline-event-notifier)
[![Node.js](https://img.shields.io/node/v/codepipeline-event-notifier?style=flat-square)](https://www.npmjs.com/package/codepipeline-event-notifier)
[![build](https://img.shields.io/github/actions/workflow/status/gammarers-aws-cdk-constructs/codepipeline-event-notifier/build.yml?branch=main&label=build&style=flat-square)](https://github.com/gammarers-aws-cdk-constructs/codepipeline-event-notifier/actions/workflows/build.yml)

[![View on Construct Hub](https://constructs.dev/badge?package=codepipeline-event-notifier)](https://constructs.dev/packages/codepipeline-event-notifier)

CDK construct that listens to **AWS CodePipeline execution STARTED** events via EventBridge, invokes a Lambda notifier, and publishes execution state changes to an SNS topic.

## Features

- **EventBridge integration**: triggers on `CodePipeline Pipeline Execution State Change` with `state=STARTED` (customizable via `eventPattern`)
- **Tag-based pipeline selection**: required `targetPipeline.tags` filters which pipelines are notified (`ListTagsForResource`; keys are AND, values are OR)
- **Least-privilege IAM**: CodePipeline API access is scoped to this account and region, or to `targetPipeline.arns` when set
- **SNS notifications**: publishes execution status transitions as JSON messages (`phase`: `eventbridge` / `wait`)
- **Execution waiting**: calls `GetPipelineExecution` until a terminal state (`SUCCEEDED` / `FAILED` / `STOPPED` / `SUPERSEDED`) or timeout
- **Configurable props**: reuse an existing SNS topic, adjust wait interval / max wait duration / Lambda timeout, and optionally refine the EventBridge pattern
- **No subscriptions by default**: the SNS topic is created (or reused), but subscriptions (email/HTTP/etc.) are intentionally not configured

## How it works

1. EventBridge matches a CodePipeline execution state-change event (default: `state=STARTED`) and invokes the notifier Lambda.
2. The Lambda resolves the pipeline ARN, then keeps the event only when `targetPipeline.tags` match (`ListTagsForResource`; keys are AND, values are OR) and, if set, `targetPipeline.arns` includes the pipeline.
3. It publishes an SNS message with `phase: eventbridge`, then calls `GetPipelineExecution` until a terminal status (`SUCCEEDED` / `FAILED` / `STOPPED` / `SUPERSEDED`) or `maxWaitDuration`.
4. Each status change (and timeout) is published with `phase: wait`. Subscribe to `notifier.topic`; this construct does not add subscriptions.

## Installation

### npm

```bash
npm install codepipeline-event-notifier
```

### yarn

```bash
yarn add codepipeline-event-notifier
```

### pnpm

```bash
pnpm add codepipeline-event-notifier
```

## Usage

Instantiate `CodePipelineEventNotifier` in your CDK stack:

```ts
import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipelineEventNotifier } from 'codepipeline-event-notifier';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const notifier = new CodePipelineEventNotifier(this, 'CodePipelineEventNotifier', {
      targetPipeline: {
        tags: [
          {
            key: 'Notify',
            values: ['true'],
          },
        ],
      },
    });

    // Optionally subscribe to the topic created by the construct
    // notifier.topic.addSubscription(...);
  }
}
```

### Customize with props

```ts
import { Duration, Stack, aws_sns as sns } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipelineEventNotifier } from 'codepipeline-event-notifier';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const topic = sns.Topic.fromTopicArn(this, 'ExistingTopic', 'arn:aws:sns:...');

    new CodePipelineEventNotifier(this, 'CodePipelineEventNotifier', {
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
        arns: [
          'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
        ],
      },
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['STARTED'],
        },
      },
    });
  }
}
```

## Options

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `targetPipeline` | `TargetPipeline` | *(required)* | Tag filters (`tags`) for pipelines that should notify. Optional `arns` restrict IAM and skip other pipelines. Default IAM is this account and region |
| `topic` | `sns.ITopic` | new topic | SNS topic to publish notifications to (also exposed as `notifier.topic`) |
| `waitInterval` | `Duration` | `10 seconds` | Interval between `GetPipelineExecution` calls |
| `maxWaitDuration` | `Duration` | `14 minutes` | Maximum wait duration before giving up |
| `timeout` | `Duration` | `15 minutes` | Notifier Lambda timeout (should exceed `maxWaitDuration`) |
| `eventPattern` | `events.EventPattern` | CodePipeline `STARTED` | EventBridge rule filter |

The notifier Lambda uses these environment variables (set by the construct from props):

- `SNS_TOPIC_ARN` (**required**): SNS topic ARN to publish notifications to
- `TARGET_PIPELINE_TAGS` (**required**): JSON array of `{ key, values }` tag filters
- `TARGET_PIPELINE_ARNS` (optional): JSON array of pipeline ARNs used as an allowlist when `targetPipeline.arns` is set
- `WAIT_INTERVAL_SECONDS` (default: `10`): wait interval in seconds
- `MAX_WAIT_MINUTES` (default: `14`): maximum wait duration in minutes

## API

See the [API reference](./API.md).

## Requirements

- Node.js `>= 20`
- AWS CDK `v2` (`aws-cdk-lib` `^2.232.0`)
- `constructs` `^10.5.1`

## License

This project is licensed under the Apache-2.0 License.
