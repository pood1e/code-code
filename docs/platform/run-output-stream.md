# Run Output Stream

## Responsibility

`RunOutput` stream is the retained, ordered AG-UI event stream for one agent run.

## External fields

- `run_id`: run scope.
- `after_sequence`: exclusive resume offset for retained output replay.

## Implementation notes

- Console SSE subscribers share one upstream stream per `run_id`.
- The shared stream keeps a bounded replay buffer keyed by `RunOutput.sequence`.
- Late subscribers receive retained events with sequence greater than `after_sequence`, then live events.
- Terminal result closes the shared stream and starts a short cleanup TTL.
- AG-UI payload semantics stay unchanged; sequence and ownership metadata stay in platform envelopes.
