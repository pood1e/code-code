# Service Background Tasks

## responsibility

Service background tasks let internal HTTP/gRPC triggers start bounded work without keeping the transport request open for the whole execution.

## fields

- `name`: registered task key.
- `timeout`: maximum runtime for one triggered execution.
- `logger`: task lifecycle and failure logger.

## methods

- `Register(config)`: adds one task key with a runtime bound.
- `Trigger(name, run)`: starts one execution when none is running, returns `accepted` or `already_running` immediately.

## implementation notes

Each service owns its registry and task body. The registry only handles task lookup, single-flight execution, timeout, panic recovery, and logging.
