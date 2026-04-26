# Agent Images

## Summary

`deploy/agents` owns agent runtime image packaging assets.

The mainline is:

- shared scripts live under `deploy/agents/common`
- per-agent entrypoints live under `deploy/agents/<agent>`
- runtime Dockerfiles live under `deploy/images/release`
- `deploy/images/docker-bake.hcl` references these assets as build targets

Agent images are not part of the operator service release mainline in `deploy/release.sh`.

## Responsibility

- Package CLI or agent runtimes as runnable container images.
- Keep image entrypoint logic close to the corresponding image.
- Reuse shared bootstrap scripts without mixing image assets back into Go packages.
- Keep real credentials out of the main container; runtime auth headers are replaced by Envoy auth processor.

## Ownership

- `deploy/agents/common/` owns shared image bootstrap scripts.
- `deploy/agents/<agent>/` owns one agent image layout.
- `deploy/images/release/*agent*.Dockerfile` owns runtime image packaging.
- `deploy/images/docker-bake.hcl` owns build target wiring only.

## Interface

- image source layout:
  - `deploy/agents/common/*`
  - `deploy/agents/<agent>/entrypoint.sh`
  - `deploy/images/release/*agent*.Dockerfile`
- build:
  - `docker buildx bake -f deploy/images/docker-bake.hcl <target>`

## Failure Behavior

- Agent entrypoints fail fast when required credential or runtime projection files are missing.
- Image builds fail fast when referenced shared scripts or per-agent assets are missing.
- Qwen image 当前只支持 OpenAI-compatible API key mainline；主容器只写 placeholder `settings.json`，真实 API key 由 Envoy auth processor 替换。
- Gemini OAuth mainline must only materialize placeholder `~/.gemini/settings.json` and `~/.gemini/oauth_creds.json` into the main container; real OAuth tokens stay in runtime auth Secret and are used by Envoy auth processor.
- Gemini OAuth config materialization must pin `security.auth.selectedType = "oauth-personal"` and keep placeholder tokens non-expiring from the main container point of view.
- Gemini image should keep runtime inputs file-first; avoid introducing auth/config envs unless a file-based input is impossible.
- Gemini runtime startup must clear explicit proxy envs so Envoy egress remains authoritative.
- Gemini runtime startup must export `GOOGLE_GENAI_USE_GCA=true` so non-interactive runs stay on the Google OAuth path.

## Extension Points

- Add one new agent image by creating `deploy/agents/<agent>/`.
- Reuse or extend `deploy/agents/common/` for shared bootstrap logic.
- Register the build target in `deploy/images/docker-bake.hcl`.
