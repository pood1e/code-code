package models

import (
	"strings"
	"testing"
)

func TestPostgresDefinitionListPredicateBuildsModelFilters(t *testing.T) {
	t.Parallel()

	filter, err := parseDefinitionListFilter("vendor_id=openai,anthropic AND source_ref=null AND badge=free")
	if err != nil {
		t.Fatalf("parseDefinitionListFilter() error = %v", err)
	}
	predicate := newPostgresDefinitionListPredicate("code-code")
	if err := predicate.apply(filter); err != nil {
		t.Fatalf("apply() error = %v", err)
	}

	whereSQL, args := predicate.where()
	for _, want := range []string{
		"namespace =",
		"vendor_id = any",
		"badges @>",
		"source_ref_vendor_id is null",
		"source_ref_model_id is null",
	} {
		if !strings.Contains(whereSQL, want) && !containsArg(args, want) {
			t.Fatalf("predicate missing %q: sql=%s args=%#v", want, whereSQL, args)
		}
	}
	if !containsArg(args, []string{"openai", "anthropic"}) {
		t.Fatalf("vendor args missing: args=%#v", args)
	}
	if !containsArg(args, `["free"]`) {
		t.Fatalf("badge args missing: args=%#v", args)
	}
}

func TestPostgresDefinitionListPredicateBuildsScanFilters(t *testing.T) {
	t.Parallel()

	filter, err := parseDefinitionListFilter(`model_id_query=GPT_% AND source_id=nvidia-integrate`)
	if err != nil {
		t.Fatalf("parseDefinitionListFilter() error = %v", err)
	}
	predicate := newPostgresDefinitionListPredicate("code-code")
	if err := predicate.apply(filter); err != nil {
		t.Fatalf("apply() error = %v", err)
	}

	whereSQL, args := predicate.where()
	for _, want := range []string{"like", "escape '\\'", "exists", "source_id = any"} {
		if !strings.Contains(whereSQL, want) {
			t.Fatalf("predicate sql missing %q: %s", want, whereSQL)
		}
	}
	if !containsArg(args, `%gpt\_\%%`) {
		t.Fatalf("escaped query arg missing: args=%#v", args)
	}
	if !containsArg(args, []string{SourceIDNVIDIAIntegrate}) {
		t.Fatalf("source id arg missing: args=%#v", args)
	}
}

func containsArg(args []any, want any) bool {
	for _, arg := range args {
		switch typed := want.(type) {
		case []string:
			values, ok := arg.([]string)
			if ok && equalStrings(values, typed) {
				return true
			}
		default:
			if arg == want {
				return true
			}
		}
	}
	return false
}
