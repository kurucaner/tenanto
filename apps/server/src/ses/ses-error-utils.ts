export function getSesErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown SES error";
}

export function isRetryableSesError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };

  const statusCode = candidate.$metadata?.httpStatusCode;
  if (statusCode === 429 || (statusCode != null && statusCode >= 500)) {
    return true;
  }

  const retryableNames = new Set([
    "InternalFailure",
    "RequestTimeout",
    "ServiceUnavailable",
    "ServiceUnavailableException",
    "Throttling",
    "ThrottlingException",
    "TooManyRequestsException",
  ]);

  return candidate.name != null && retryableNames.has(candidate.name);
}

export function isPermanentSesError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };

  const statusCode = candidate.$metadata?.httpStatusCode;
  if (statusCode === 400 || statusCode === 404) {
    return true;
  }

  const permanentNames = new Set([
    "AccountSendingPausedException",
    "InvalidParameterValue",
    "MailFromDomainNotVerifiedException",
    "MessageRejected",
  ]);

  return candidate.name != null && permanentNames.has(candidate.name);
}
