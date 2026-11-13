# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### CodePipelinePipelineExecutionEventNotifier <a name="CodePipelinePipelineExecutionEventNotifier" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier"></a>

Provisions an EventBridge rule that listens for CodePipeline execution STARTED events, then invokes a durable notifier Lambda which publishes execution state changes to an SNS topic.

#### Initializers <a name="Initializers" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.Initializer"></a>

```typescript
import { CodePipelinePipelineExecutionEventNotifier } from 'codepipeline-pipeline-execution-event-notifier'

new CodePipelinePipelineExecutionEventNotifier(scope: Construct, id: string, props: CodePipelinePipelineExecutionEventNotifierProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | the construct scope. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.Initializer.parameter.id">id</a></code> | <code>string</code> | the construct id. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.Initializer.parameter.props">props</a></code> | <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps">CodePipelinePipelineExecutionEventNotifierProps</a></code> | construct properties. |

---

##### `scope`<sup>Required</sup> <a name="scope" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

the construct scope.

---

##### `id`<sup>Required</sup> <a name="id" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.Initializer.parameter.id"></a>

- *Type:* string

the construct id.

---

##### `props`<sup>Required</sup> <a name="props" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.Initializer.parameter.props"></a>

- *Type:* <a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps">CodePipelinePipelineExecutionEventNotifierProps</a>

construct properties.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.isConstruct"></a>

```typescript
import { CodePipelinePipelineExecutionEventNotifier } from 'codepipeline-pipeline-execution-event-notifier'

CodePipelinePipelineExecutionEventNotifier.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.property.topic">topic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | SNS topic that receives CodePipeline execution notifications. |

---

##### `node`<sup>Required</sup> <a name="node" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `topic`<sup>Required</sup> <a name="topic" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifier.property.topic"></a>

```typescript
public readonly topic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic

SNS topic that receives CodePipeline execution notifications.

---


## Structs <a name="Structs" id="Structs"></a>

### CodePipelinePipelineExecutionEventNotifierProps <a name="CodePipelinePipelineExecutionEventNotifierProps" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps"></a>

Properties for {@link CodePipelinePipelineExecutionEventNotifier}.

#### Initializer <a name="Initializer" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.Initializer"></a>

```typescript
import { CodePipelinePipelineExecutionEventNotifierProps } from 'codepipeline-pipeline-execution-event-notifier'

const codePipelinePipelineExecutionEventNotifierProps: CodePipelinePipelineExecutionEventNotifierProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.targetPipeline">targetPipeline</a></code> | <code><a href="#codepipeline-pipeline-execution-event-notifier.TargetPipeline">TargetPipeline</a></code> | Pipelines that should produce notifications, selected by resource tags. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.durableRetentionPeriod">durableRetentionPeriod</a></code> | <code>aws-cdk-lib.Duration</code> | How long Lambda retains durable execution history after the execution closes. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.eventPattern">eventPattern</a></code> | <code>aws-cdk-lib.aws_events.EventPattern</code> | EventBridge event pattern that triggers the notifier. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.maxWaitDuration">maxWaitDuration</a></code> | <code>aws-cdk-lib.Duration</code> | Maximum duration to wait for execution state changes. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.timeout">timeout</a></code> | <code>aws-cdk-lib.Duration</code> | Timeout for a single notifier Lambda invocation. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.topic">topic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | SNS topic that receives CodePipeline execution notifications. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.waitInterval">waitInterval</a></code> | <code>aws-cdk-lib.Duration</code> | Interval between durable waits around `GetPipelineExecution` checks. |

---

##### `targetPipeline`<sup>Required</sup> <a name="targetPipeline" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.targetPipeline"></a>

```typescript
public readonly targetPipeline: TargetPipeline;
```

- *Type:* <a href="#codepipeline-pipeline-execution-event-notifier.TargetPipeline">TargetPipeline</a>

Pipelines that should produce notifications, selected by resource tags.

---

##### `durableRetentionPeriod`<sup>Optional</sup> <a name="durableRetentionPeriod" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.durableRetentionPeriod"></a>

```typescript
public readonly durableRetentionPeriod: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.days(14)

How long Lambda retains durable execution history after the execution closes.

---

##### `eventPattern`<sup>Optional</sup> <a name="eventPattern" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.eventPattern"></a>

```typescript
public readonly eventPattern: EventPattern;
```

- *Type:* aws-cdk-lib.aws_events.EventPattern
- *Default:* CodePipeline Pipeline Execution State Change with `state=STARTED`

EventBridge event pattern that triggers the notifier.

---

##### `maxWaitDuration`<sup>Optional</sup> <a name="maxWaitDuration" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.maxWaitDuration"></a>

```typescript
public readonly maxWaitDuration: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.minutes(14)

Maximum duration to wait for execution state changes.

Mapped to the notifier Lambda environment variable `MAX_WAIT_MINUTES`
and to the durable function `executionTimeout`.

---

##### `timeout`<sup>Optional</sup> <a name="timeout" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.timeout"></a>

```typescript
public readonly timeout: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.minutes(5)

Timeout for a single notifier Lambda invocation.

Durable waits suspend between invocations, so this need not cover {@link maxWaitDuration}.

---

##### `topic`<sup>Optional</sup> <a name="topic" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.topic"></a>

```typescript
public readonly topic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic
- *Default:* a new topic is created

SNS topic that receives CodePipeline execution notifications.

Subscriptions (email/HTTP/etc.) are intentionally not managed by this construct.

---

##### `waitInterval`<sup>Optional</sup> <a name="waitInterval" id="codepipeline-pipeline-execution-event-notifier.CodePipelinePipelineExecutionEventNotifierProps.property.waitInterval"></a>

```typescript
public readonly waitInterval: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.seconds(10)

Interval between durable waits around `GetPipelineExecution` checks.

---

### TargetPipeline <a name="TargetPipeline" id="codepipeline-pipeline-execution-event-notifier.TargetPipeline"></a>

Selection criteria for pipelines that should trigger notifications.

#### Initializer <a name="Initializer" id="codepipeline-pipeline-execution-event-notifier.TargetPipeline.Initializer"></a>

```typescript
import { TargetPipeline } from 'codepipeline-pipeline-execution-event-notifier'

const targetPipeline: TargetPipeline = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.TargetPipeline.property.tags">tags</a></code> | <code><a href="#codepipeline-pipeline-execution-event-notifier.TargetPipelineTag">TargetPipelineTag</a>[]</code> | Tag filters applied to CodePipeline resources. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.TargetPipeline.property.arns">arns</a></code> | <code>string[]</code> | Pipeline ARNs used as IAM resources for `GetPipelineExecution` and `ListTagsForResource`. |

---

##### `tags`<sup>Required</sup> <a name="tags" id="codepipeline-pipeline-execution-event-notifier.TargetPipeline.property.tags"></a>

```typescript
public readonly tags: TargetPipelineTag[];
```

- *Type:* <a href="#codepipeline-pipeline-execution-event-notifier.TargetPipelineTag">TargetPipelineTag</a>[]

Tag filters applied to CodePipeline resources.

---

##### `arns`<sup>Optional</sup> <a name="arns" id="codepipeline-pipeline-execution-event-notifier.TargetPipeline.property.arns"></a>

```typescript
public readonly arns: string[];
```

- *Type:* string[]
- *Default:* all CodePipeline resources in this account and region

Pipeline ARNs used as IAM resources for `GetPipelineExecution` and `ListTagsForResource`.

When set, the notifier also ignores STARTED events whose pipeline ARN is not in this list.

---

### TargetPipelineTag <a name="TargetPipelineTag" id="codepipeline-pipeline-execution-event-notifier.TargetPipelineTag"></a>

Tag filter for selecting CodePipeline pipelines.

Keys across entries are AND; values within an entry are OR.

#### Initializer <a name="Initializer" id="codepipeline-pipeline-execution-event-notifier.TargetPipelineTag.Initializer"></a>

```typescript
import { TargetPipelineTag } from 'codepipeline-pipeline-execution-event-notifier'

const targetPipelineTag: TargetPipelineTag = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.TargetPipelineTag.property.key">key</a></code> | <code>string</code> | Tag key that must be present on the pipeline. |
| <code><a href="#codepipeline-pipeline-execution-event-notifier.TargetPipelineTag.property.values">values</a></code> | <code>string[]</code> | Accepted values for {@link key}. |

---

##### `key`<sup>Required</sup> <a name="key" id="codepipeline-pipeline-execution-event-notifier.TargetPipelineTag.property.key"></a>

```typescript
public readonly key: string;
```

- *Type:* string

Tag key that must be present on the pipeline.

---

##### `values`<sup>Required</sup> <a name="values" id="codepipeline-pipeline-execution-event-notifier.TargetPipelineTag.property.values"></a>

```typescript
public readonly values: string[];
```

- *Type:* string[]

Accepted values for {@link key}.

---



