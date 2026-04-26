package parser

import (
	"fmt"
	"strings"
)

type Registry struct {
	factories map[string]Factory
}

func NewRegistry() *Registry {
	return &Registry{factories: map[string]Factory{}}
}

func (r *Registry) Register(cliID string, factory Factory) error {
	if factory == nil {
		return fmt.Errorf("parser: register %q: nil factory", cliID)
	}
	normalized := strings.TrimSpace(cliID)
	if normalized == "" {
		return fmt.Errorf("parser: register: empty cli_id")
	}
	if _, exists := r.factories[normalized]; exists {
		return fmt.Errorf("parser: register %q: duplicate cli_id", normalized)
	}
	r.factories[normalized] = factory
	return nil
}

func (r *Registry) New(cliID string) (Parser, error) {
	factory, ok := r.factories[strings.TrimSpace(cliID)]
	if !ok {
		return nil, fmt.Errorf("parser: cli_id %q is not registered", cliID)
	}
	return factory(), nil
}
