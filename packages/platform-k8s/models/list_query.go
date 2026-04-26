package models

import (
	"strings"

	"code-code.internal/go-contract/domainerror"
)

type definitionListFilter struct {
	vendorID     []string
	modelID      string
	modelIDQuery string
	sourceID     []string
	badge        string
	sourceRefNil bool
	sourceVendor []string
	sourceModel  []string
}

func parseDefinitionListFilter(raw string) (*definitionListFilter, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return &definitionListFilter{}, nil
	}

	filter := &definitionListFilter{}
	clauses := strings.Split(raw, "AND")
	for _, clause := range clauses {
		clause = strings.TrimSpace(clause)
		if clause == "" {
			continue
		}
		parts := strings.SplitN(clause, "=", 2)
		if len(parts) != 2 {
			return nil, domainerror.NewValidation("platformk8s/models: unsupported filter clause %q", clause)
		}
		field := strings.TrimSpace(parts[0])
		values := parseFilterValues(parts[1])
		if len(values) == 0 {
			return nil, domainerror.NewValidation("platformk8s/models: filter values are empty for %q", field)
		}
		switch field {
		case "vendor_id":
			filter.vendorID = append([]string(nil), values...)
		case "model_id":
			if len(values) != 1 {
				return nil, domainerror.NewValidation("platformk8s/models: model_id filter does not support multiple values")
			}
			filter.modelID = values[0]
		case "model_id_query", "name_query":
			if len(values) != 1 {
				return nil, domainerror.NewValidation("platformk8s/models: model_id_query filter does not support multiple values")
			}
			filter.modelIDQuery = values[0]
		case "source_id":
			normalized := normalizeDefinitionSourceIDs(values)
			if len(normalized) == 0 {
				return nil, domainerror.NewValidation("platformk8s/models: unsupported source_id values")
			}
			filter.sourceID = normalized
		case "badge":
			if len(values) != 1 {
				return nil, domainerror.NewValidation("platformk8s/models: badge filter does not support multiple values")
			}
			filter.badge = normalizeDefinitionSourceBadge(values[0])
			if filter.badge == "" {
				return nil, domainerror.NewValidation("platformk8s/models: unsupported badge %q", values[0])
			}
		case "source_ref":
			if len(values) != 1 {
				return nil, domainerror.NewValidation("platformk8s/models: source_ref filter does not support multiple values")
			}
			if strings.TrimSpace(strings.ToLower(values[0])) != "null" {
				return nil, domainerror.NewValidation("platformk8s/models: unsupported source_ref value %q", values[0])
			}
			filter.sourceRefNil = true
		case "source_vendor_id":
			filter.sourceVendor = append([]string(nil), values...)
		case "source_model_id":
			filter.sourceModel = append([]string(nil), values...)
		default:
			return nil, domainerror.NewValidation("platformk8s/models: unsupported filter field %q", field)
		}
	}

	return filter, nil
}

func (f *definitionListFilter) usesScanQuery() bool {
	if f == nil {
		return false
	}
	return strings.TrimSpace(f.modelIDQuery) != "" || len(f.sourceID) > 0
}
