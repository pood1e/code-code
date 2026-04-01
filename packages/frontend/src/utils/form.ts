export function isFormValidationError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'errorFields' in error &&
      Array.isArray(error.errorFields)
  );
}
