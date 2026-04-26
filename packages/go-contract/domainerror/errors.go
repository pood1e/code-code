// Package domainerror defines typed error categories for platform domain services.
// These errors enable the gRPC layer to map domain failures to precise status codes
// without fragile string matching.
package domainerror

import "fmt"

// AlreadyExistsError indicates a resource already exists.
type AlreadyExistsError struct{ Message string }

func (e *AlreadyExistsError) Error() string { return e.Message }

// NewAlreadyExists creates one AlreadyExistsError.
func NewAlreadyExists(format string, args ...any) *AlreadyExistsError {
	return &AlreadyExistsError{Message: fmt.Sprintf(format, args...)}
}

// NotFoundError indicates a resource was not found.
type NotFoundError struct{ Message string }

func (e *NotFoundError) Error() string { return e.Message }

// NewNotFound creates one NotFoundError.
func NewNotFound(format string, args ...any) *NotFoundError {
	return &NotFoundError{Message: fmt.Sprintf(format, args...)}
}

// ValidationError indicates invalid input.
type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

// NewValidation creates one ValidationError.
func NewValidation(format string, args ...any) *ValidationError {
	return &ValidationError{Message: fmt.Sprintf(format, args...)}
}

// ReferenceConflictError indicates a resource cannot be deleted due to active references.
type ReferenceConflictError struct{ Message string }

func (e *ReferenceConflictError) Error() string { return e.Message }

// NewReferenceConflict creates one ReferenceConflictError.
func NewReferenceConflict(format string, args ...any) *ReferenceConflictError {
	return &ReferenceConflictError{Message: fmt.Sprintf(format, args...)}
}
