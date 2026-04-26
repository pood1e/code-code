type ModelRefLike = {
  vendorId?: string;
  modelId?: string;
};

export function buildFilter(
  vendorIds: string[],
  modelQuery: string,
  sourceIds: string[] = [],
  badge = ""
) {
  const clauses: string[] = [];
  const query = sanitizeFilterValue(modelQuery);
  if (query) {
    clauses.push(`model_id_query=${query}`);
  }
  if (vendorIds.length > 0) {
    clauses.push(`vendor_id=${vendorIds.join(",")}`);
  }
  if (sourceIds.length > 0) {
    clauses.push(`source_id=${sourceIds.join(",")}`);
  }
  if (badge.trim()) {
    clauses.push(`badge=${sanitizeFilterValue(badge)}`);
  }
  return clauses.join(" AND ");
}

export function buildDirectFilter(
  vendorIds: string[],
  modelQuery: string,
  sourceIds: string[] = [],
  badge = ""
) {
  const clauses = ["source_ref=null"];
  const base = buildFilter(vendorIds, modelQuery, sourceIds, badge);
  if (base) {
    clauses.push(base);
  }
  return clauses.join(" AND ");
}

export function buildRelatedBatchFilter(refs: ModelRefLike[]) {
  const vendorIds = Array.from(new Set(
    refs.map((ref) => sanitizeFilterValue(ref.vendorId || "")).filter(Boolean)
  ));
  const modelIds = Array.from(new Set(
    refs.map((ref) => sanitizeFilterValue(ref.modelId || "")).filter(Boolean)
  ));
  if (vendorIds.length === 0 || modelIds.length === 0) {
    return "";
  }
  return [
    `source_vendor_id=${vendorIds.join(",")}`,
    `source_model_id=${modelIds.join(",")}`,
  ].join(" AND ");
}

function sanitizeFilterValue(value: string) {
  return value.trim().replace(/[,\n\r]+/g, " ").replace(/\bAND\b/gi, " ");
}

export function toggleSelected(values: string[], value: string) {
  const current = new Set(values);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  return Array.from(current).sort();
}
