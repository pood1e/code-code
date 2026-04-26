# MCPServer

这份文档定义 `MCPServer` 的平台抽象。

## 职责

`MCPServer` 负责表达：

- 一个稳定的 MCP 资源标识
- 一个 operator-facing MCP 名称
- 一个官方 MCP transport 配置

## MCPServer

- `MCPID`
  作用：标识一个稳定 MCP 资源。
- `Name`
  作用：operator-facing MCP display name。
- `Transport`
  作用：保存这个 MCP 使用的单一 transport 配置。

## 存储

- truth is stored in Postgres table `platform_mcp_servers`

## 方法

- `mcpservers.Store`
- `mcpservers.NewRepository(pool)`
- `mcpservers.Service.List/Get/Create/Update/Delete`

## Transport

支持的主线只有：

- `stdio`
  作用：平台启动本地子进程并通过标准输入输出连接 MCP server。
- `Streamable HTTP`
  作用：平台通过单个 MCP endpoint URL 连接远端 MCP server。

规则：

- `stdio` 只保存 `command`、ordered `args` 与 ordered `env`。
- `Streamable HTTP` 只保存 `endpoint_url` 与 ordered `headers`。
- v1 不接入 `Credential` 域，不表达 OAuth lifecycle。
- v1 不支持已废弃的 `HTTP+SSE` transport。
