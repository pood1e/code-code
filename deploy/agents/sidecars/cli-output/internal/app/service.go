package app

import (
	"context"
	"time"

	"code-code.internal/cli-output-sidecar/internal/events"
	runtimesidecarv1 "code-code.internal/go-contract/agent/runtime_sidecar/v1"
	runeventv1 "code-code.internal/go-contract/platform/run_event/v1"
)

type Service struct {
	runtimesidecarv1.UnimplementedCLIOutputSidecarServiceServer
	publisher events.Publisher
	state     *State
}

func NewService(state *State, publisher events.Publisher) *Service {
	return &Service{state: state, publisher: publisher}
}

func (s *Service) GetAccumulator(context.Context, *runtimesidecarv1.GetAccumulatorRequest) (*runtimesidecarv1.GetAccumulatorResponse, error) {
	snapshot, err := s.state.Snapshot()
	if err != nil {
		return nil, err
	}
	return &runtimesidecarv1.GetAccumulatorResponse{
		LastSequence:  snapshot.LastSequence,
		AssistantText: snapshot.AssistantText,
		ReasoningText: snapshot.ReasoningText,
	}, nil
}

func (s *Service) Stop(_ context.Context, request *runtimesidecarv1.StopRequest) (*runtimesidecarv1.StopResponse, error) {
	if err := s.state.RequestStop(request.GetForce(), time.Now()); err != nil {
		return nil, err
	}
	snapshot, err := s.state.Snapshot()
	if err != nil {
		return nil, err
	}
	if err := s.publisher.PublishStatus(context.Background(), runeventv1.RunStatusPhase_RUN_STATUS_PHASE_STOPPING, snapshot, "stop requested"); err != nil {
		return nil, err
	}
	return &runtimesidecarv1.StopResponse{Accepted: true}, nil
}
