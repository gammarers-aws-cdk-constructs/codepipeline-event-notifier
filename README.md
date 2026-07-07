# CodePipeline Event Notifier

[![npm version](https://img.shields.io/npm/v/codepipeline-event-notifier.svg)](https://www.npmjs.com/package/codepipeline-event-notifier)
[![license](https://img.shields.io/npm/l/codepipeline-event-notifier.svg)](LICENSE)

CDK construct that listens to **AWS CodePipeline execution STARTED** events via EventBridge, invokes a Lambda notifier, and publishes execution state changes to an SNS topic.

## Features

- **EventBridge integration**: triggers on `CodePipeline Pipeline Execution State Change` with `state=STARTED`
- **SNS notifications**: publishes execution status transitions (observed while polling) as JSON messages
- **Execution polling**: polls `GetPipelineExecution` until a terminal state or timeout
- **No subscriptions by default**: the SNS Topic is created, but subscriptions (email/HTTP/etc.) are intentionally not configured

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

    new CodePipelineEventNotifier(this, 'CodePipelineEventNotifier');
  }
}
```

## Options

The notifier Lambda supports the following environment variables:

- `SNS_TOPIC_ARN` (**required**): SNS topic ARN to publish notifications to (provided by the construct)
- `POLL_INTERVAL_SECONDS` (default: `10`): poll interval in seconds
- `MAX_POLL_MINUTES` (default: `14`): maximum polling duration in minutes (Lambda should be configured with a matching timeout)

## Requirements

- Node.js `>= 20`
- AWS CDK `v2` (`aws-cdk-lib`)

## License

This project is licensed under the Apache-2.0 License.