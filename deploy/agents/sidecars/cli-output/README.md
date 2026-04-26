# CLI Output Sidecar

这个目录承载 `CLIOutputSidecar` 的实现资产。

它统一归到 `deploy/agents/sidecars/`，只负责 CLI 输出采集，不参与网络出口。

- sidecar image build
- FIFO / UDS bootstrap
- parser common abstraction
- parser registry
- local accumulator
- pod-local gRPC `/acc` `/stop`
- JetStream `run_delta / run_result / run_status`
