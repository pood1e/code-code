# OAuth Execution

## responsibility

OAuth execution is owned by `platform-auth-service`.

## implementation notes

Provider connect and reauthorization call auth through gRPC. Other services do not own OAuth session state or credential material.
