# Console Web Workspace Package Manager

## Responsibility

- 维护 `packages/console-web` workspace 的单一 Node/pnpm toolchain 和 lockfile contract。
- 让 `app`、`showcase`、`packages/*` 与 `../agent-contract` 共享同一 install、build、typecheck、test 入口。

## External Surface

- `packages/console-web/package.json` 的 `packageManager` 与 `engines.node`
- `packages/console-web/pnpm-workspace.yaml`
- `pnpm --dir packages/console-web install --frozen-lockfile`
- `pnpm --dir packages/console-web build`
- `pnpm --dir packages/console-web typecheck`
- `pnpm --dir packages/console-web test`
- `pnpm --dir packages/console-web lint`

## Implementation Notes

- 当前 toolchain contract 是 `pnpm@10.33.0` 和 Node `>=24 <25`。
- `pnpm-workspace.yaml` 只纳入 `../agent-contract`、`app`、`showcase` 和 `packages/*`；workspace 只有一个 lockfile `packages/console-web/pnpm-lock.yaml`。
- `injectWorkspacePackages: true` 负责 workspace package linking，成员包不维护独立 lockfile。
