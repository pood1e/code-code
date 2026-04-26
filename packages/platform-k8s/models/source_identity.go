package models

func normalizeDefinitionSourceVendorID(value string) string {
	return normalizedVendorSlug(value)
}

func normalizeDefinitionSourceAliasID(value string) string {
	return normalizedVendorSlug(value)
}
