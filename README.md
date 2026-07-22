# CodePipeline Event Notifier

[![npm version](https://img.shields.io/npm/v/codepipeline-event-notifier.svg)](https://www.npmjs.com/package/codepipeline-event-notifier)
[![license](https://img.shields.io/npm/l/codepipeline-event-notifier.svg)](LICENSE)

CDK construct that listens to **AWS CodePipeline execution STARTED** events via EventBridge, invokes a Lambda notifier, and publishes execution state changes to an SNS topic.

## Features

- **EventBridge integration**: triggers on `CodePipeline Pipeline Execution State Change` with `state=STARTED` (customizable via `eventPattern`)
- **SNS notifications**: publishes execution status transitions as JSON messages (`phase`: `eventbridge` / `wait`)
- **Execution waiting**: calls `GetPipelineExecution` until a terminal state (`SUCCEEDED` / `FAILED` / `STOPPED` / `SUPERSEDED`) or timeout
- **Configurable props**: reuse an existing SNS topic, adjust wait interval / max wait duration / Lambda timeout, and filter events
- **No subscriptions by default**: the SNS topic is created (or reused), but subscriptions (email/HTTP/etc.) are intentionally not configured

## Installation

### npm

```bash
npm install codepipeline-event-notifier
```

### yarn

```bash
yarn add codepipeline-event-notifier
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

    const notifier = new CodePipelineEventNotifier(this, 'CodePipelineEventNotifier');

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
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['STARTED'],
          pipeline: ['my-pipeline'],
        },
      },
    });
  }
}
```

## Options

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `topic` | `sns.ITopic` | new topic | SNS topic to publish notifications to (also exposed as `notifier.topic`) |
| `waitInterval` | `Duration` | `10 seconds` | Interval between `GetPipelineExecution` calls |
| `maxWaitDuration` | `Duration` | `14 minutes` | Maximum wait duration before giving up |
| `timeout` | `Duration` | `15 minutes` | Notifier Lambda timeout (should exceed `maxWaitDuration`) |
| `eventPattern` | `events.EventPattern` | CodePipeline `STARTED` | EventBridge rule filter |

The notifier Lambda uses these environment variables (set by the construct from props):

- `SNS_TOPIC_ARN` (**required**): SNS topic ARN to publish notifications to
- `WAIT_INTERVAL_SECONDS` (default: `10`): wait interval in seconds
- `MAX_WAIT_MINUTES` (default: `14`): maximum wait duration in minutes

## Requirements

- Node.js `>= 20`
- AWS CDK `v2` (`aws-cdk-lib` `^2.232.0`)
- `constructs` `^10.5.1`

## License

This project is licensed under the Apache-2.0 License.
