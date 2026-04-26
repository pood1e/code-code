# Session Prepare Jobs

## responsibility

`AgentSession` owns future-turn prepare job setup. Each accepted turn freezes the
current session prepare jobs into `AgentRun.prepare_jobs`.

## external fields

- `AgentSessionSpec.prepare_jobs`
- `AgentSessionPrepareJob.job_id`
- `AgentSessionPrepareJob.cli_id`
- `AgentSessionPrepareJob.job_type`
- `AgentSessionPrepareJob.run_type`
- `AgentSessionPrepareJob.change_key`
- `AgentSessionPrepareJob.cleanup`
- `AgentSessionPrepareJob.parameters_yaml`

## implementation notes

`parameters_yaml` is CLI-owned. The platform only validates the common envelope,
freezes it into the run snapshot, and lets the AgentRun Temporal workflow expand
each frozen job into a Kubernetes execution step before the main run container.

The platform appends the run-scoped auth prepare job when the session did not
provide one, so chat can boot with only runtime setup.

`AgentRunStatus.prepare_jobs` stores the observed summary projected from the
workflow step with the same frozen job order. Chat exposes this progress as
AG-UI `ACTIVITY_SNAPSHOT activityType=TURN` `steps[]`.
