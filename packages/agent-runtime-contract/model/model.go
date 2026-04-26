// Package model defines the runtime behavior contract for resolving default
// model definitions and provider overrides.
package model

import (
	"context"

	modelv1 "code-code.internal/go-contract/model/v1"
)

// ModelRef references one default model definition.
type ModelRef = modelv1.ModelRef

// ModelDefinition describes one default model definition.
type ModelDefinition = modelv1.ModelDefinition

// ModelOverride describes provider-supplied overrides for one default model
// definition.
type ModelOverride = modelv1.ModelOverride

// ResolvedModel describes the effective model after merging the default
// definition with one optional override.
type ResolvedModel = modelv1.ResolvedModel

// Registry resolves default model definitions and provider overrides.
type Registry interface {
	// Get returns the default model definition referenced by ref.
	Get(ctx context.Context, ref *ModelRef) (*ModelDefinition, error)

	// ResolveRef returns the canonical model ref for a model id or alias string.
	ResolveRef(ctx context.Context, modelIDOrAlias string) (*ModelRef, error)

	// Resolve returns the effective model after applying override to the
	// referenced default model definition.
	Resolve(ctx context.Context, ref *ModelRef, override *ModelOverride) (*ResolvedModel, error)
}
