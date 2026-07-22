# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### CodePipelineEventNotifier <a name="CodePipelineEventNotifier" id="codepipeline-event-notifier.CodePipelineEventNotifier"></a>

Provisions an EventBridge rule that listens for CodePipeline execution STARTED events, then invokes a notifier Lambda which publishes execution state changes to an SNS topic.

#### Initializers <a name="Initializers" id="codepipeline-event-notifier.CodePipelineEventNotifier.Initializer"></a>

```typescript
import { CodePipelineEventNotifier } from 'codepipeline-event-notifier'

new CodePipelineEventNotifier(scope: Construct, id: string, props?: CodePipelineEventNotifierProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | the construct scope. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.Initializer.parameter.id">id</a></code> | <code>string</code> | the construct id. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.Initializer.parameter.props">props</a></code> | <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifierProps">CodePipelineEventNotifierProps</a></code> | construct properties. |

---

##### `scope`<sup>Required</sup> <a name="scope" id="codepipeline-event-notifier.CodePipelineEventNotifier.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

the construct scope.

---

##### `id`<sup>Required</sup> <a name="id" id="codepipeline-event-notifier.CodePipelineEventNotifier.Initializer.parameter.id"></a>

- *Type:* string

the construct id.

---

##### `props`<sup>Optional</sup> <a name="props" id="codepipeline-event-notifier.CodePipelineEventNotifier.Initializer.parameter.props"></a>

- *Type:* <a href="#codepipeline-event-notifier.CodePipelineEventNotifierProps">CodePipelineEventNotifierProps</a>

construct properties.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="codepipeline-event-notifier.CodePipelineEventNotifier.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="codepipeline-event-notifier.CodePipelineEventNotifier.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="codepipeline-event-notifier.CodePipelineEventNotifier.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="codepipeline-event-notifier.CodePipelineEventNotifier.isConstruct"></a>

```typescript
import { CodePipelineEventNotifier } from 'codepipeline-event-notifier'

CodePipelineEventNotifier.isConstruct(x: any)
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

###### `x`<sup>Required</sup> <a name="x" id="codepipeline-event-notifier.CodePipelineEventNotifier.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifier.property.topic">topic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | SNS topic that receives CodePipeline execution notifications. |

---

##### `node`<sup>Required</sup> <a name="node" id="codepipeline-event-notifier.CodePipelineEventNotifier.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `topic`<sup>Required</sup> <a name="topic" id="codepipeline-event-notifier.CodePipelineEventNotifier.property.topic"></a>

```typescript
public readonly topic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic

SNS topic that receives CodePipeline execution notifications.

---


## Structs <a name="Structs" id="Structs"></a>

### CodePipelineEventNotifierProps <a name="CodePipelineEventNotifierProps" id="codepipeline-event-notifier.CodePipelineEventNotifierProps"></a>

Properties for {@link CodePipelineEventNotifier}.

#### Initializer <a name="Initializer" id="codepipeline-event-notifier.CodePipelineEventNotifierProps.Initializer"></a>

```typescript
import { CodePipelineEventNotifierProps } from 'codepipeline-event-notifier'

const codePipelineEventNotifierProps: CodePipelineEventNotifierProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifierProps.property.eventPattern">eventPattern</a></code> | <code>aws-cdk-lib.aws_events.EventPattern</code> | EventBridge event pattern that triggers the notifier. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifierProps.property.maxWaitDuration">maxWaitDuration</a></code> | <code>aws-cdk-lib.Duration</code> | Maximum duration to wait for execution state changes. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifierProps.property.timeout">timeout</a></code> | <code>aws-cdk-lib.Duration</code> | Timeout for the notifier Lambda function. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifierProps.property.topic">topic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | SNS topic that receives CodePipeline execution notifications. |
| <code><a href="#codepipeline-event-notifier.CodePipelineEventNotifierProps.property.waitInterval">waitInterval</a></code> | <code>aws-cdk-lib.Duration</code> | Interval between `GetPipelineExecution` waits. |

---

##### `eventPattern`<sup>Optional</sup> <a name="eventPattern" id="codepipeline-event-notifier.CodePipelineEventNotifierProps.property.eventPattern"></a>

```typescript
public readonly eventPattern: EventPattern;
```

- *Type:* aws-cdk-lib.aws_events.EventPattern
- *Default:* CodePipeline Pipeline Execution State Change with `state=STARTED`

EventBridge event pattern that triggers the notifier.

---

##### `maxWaitDuration`<sup>Optional</sup> <a name="maxWaitDuration" id="codepipeline-event-notifier.CodePipelineEventNotifierProps.property.maxWaitDuration"></a>

```typescript
public readonly maxWaitDuration: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.minutes(14)

Maximum duration to wait for execution state changes.

Mapped to the notifier Lambda environment variable `MAX_WAIT_MINUTES`.

---

##### `timeout`<sup>Optional</sup> <a name="timeout" id="codepipeline-event-notifier.CodePipelineEventNotifierProps.property.timeout"></a>

```typescript
public readonly timeout: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.minutes(15)

Timeout for the notifier Lambda function.

Should be greater than {@link maxWaitDuration}.

---

##### `topic`<sup>Optional</sup> <a name="topic" id="codepipeline-event-notifier.CodePipelineEventNotifierProps.property.topic"></a>

```typescript
public readonly topic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic
- *Default:* a new topic is created

SNS topic that receives CodePipeline execution notifications.

Subscriptions (email/HTTP/etc.) are intentionally not managed by this construct.

---

##### `waitInterval`<sup>Optional</sup> <a name="waitInterval" id="codepipeline-event-notifier.CodePipelineEventNotifierProps.property.waitInterval"></a>

```typescript
public readonly waitInterval: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.seconds(10)

Interval between `GetPipelineExecution` waits.

---



