export function requestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error.trim();
  }
  return fallback;
}

export function firstErrorMessage(...errors: readonly unknown[]): string {
  for (const error of errors) {
    if (error instanceof Error && error.message.trim() !== "") {
      return error.message.trim();
    }
    if (typeof error === "string" && error.trim() !== "") {
      return error.trim();
    }
  }
  return "";
}

export function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
