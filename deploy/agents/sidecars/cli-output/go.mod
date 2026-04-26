module code-code.internal/cli-output-sidecar

go 1.26.2

require (
	code-code.internal/go-contract v0.0.0
	github.com/ag-ui-protocol/ag-ui/sdks/community/go v0.0.0-20260422125645-db533d2903cd
	github.com/nats-io/nats.go v1.50.0
	google.golang.org/grpc v1.80.0
	google.golang.org/protobuf v1.36.11
)

require (
	github.com/google/uuid v1.6.0 // indirect
	github.com/klauspost/compress v1.18.5 // indirect
	github.com/nats-io/nkeys v0.4.15 // indirect
	github.com/nats-io/nuid v1.0.1 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	golang.org/x/crypto v0.49.0 // indirect
	golang.org/x/net v0.51.0 // indirect
	golang.org/x/sys v0.42.0 // indirect
	golang.org/x/text v0.35.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260120221211-b8f7ae30c516 // indirect
)

replace code-code.internal/go-contract => ../../../../packages/go-contract
