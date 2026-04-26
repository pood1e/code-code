package app

import (
	"sync"
	"time"

	"code-code.internal/cli-output-sidecar/internal/parser"
	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

const accumulatorFlushInterval = 250 * time.Millisecond

type State struct {
	accumulatorPath string
	parser          parser.Parser
	stopPath        string
	flushInterval   time.Duration
	lastFlush       time.Time
	dirty           bool

	mu sync.RWMutex
}

func NewState(p parser.Parser, accumulatorPath, stopPath string) *State {
	return &State{accumulatorPath: accumulatorPath, parser: p, stopPath: stopPath, flushInterval: accumulatorFlushInterval}
}

func (s *State) ParseLine(line []byte, at time.Time) ([]*outputv1.RunOutput, error) {
	s.mu.Lock()
	outputs, err := s.parser.ParseLine(line, at)
	snapshot := s.parser.Snapshot()
	flush := s.recordSnapshotLocked(at, false)
	s.mu.Unlock()
	if err != nil {
		return nil, err
	}
	if flush {
		if err := writeJSONFile(s.accumulatorPath, snapshot); err != nil {
			return nil, err
		}
	}
	return outputs, nil
}

func (s *State) Flush(at time.Time) (parser.Snapshot, error) {
	s.mu.Lock()
	snapshot := s.parser.Snapshot()
	flush := s.recordSnapshotLocked(at, true)
	s.mu.Unlock()
	if flush {
		if err := writeJSONFile(s.accumulatorPath, snapshot); err != nil {
			return parser.Snapshot{}, err
		}
	}
	return snapshot, nil
}

func (s *State) recordSnapshotLocked(at time.Time, force bool) bool {
	if !force && !s.lastFlush.IsZero() && at.Sub(s.lastFlush) < s.flushInterval {
		s.dirty = true
		return false
	}
	s.lastFlush = at
	s.dirty = false
	return true
}

func (s *State) Snapshot() (parser.Snapshot, error) {
	s.mu.RLock()
	snapshot := s.parser.Snapshot()
	s.mu.RUnlock()
	return snapshot, nil
}

func (s *State) RequestStop(force bool, at time.Time) error {
	if _, err := s.Flush(at); err != nil {
		return err
	}
	return writeJSONFile(s.stopPath, map[string]any{
		"force":        force,
		"requested_at": at.UTC().Format(time.RFC3339Nano),
	})
}
