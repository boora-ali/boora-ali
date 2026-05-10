import axios from "axios";

export type ApiErrorState = {
  code?: string;
  message: string;
  fieldErrors: Record<string, string>;
};

function normalizeFieldErrors(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([field, fieldValue]) => {
      if (Array.isArray(fieldValue)) {
        return [field, String(fieldValue[0] ?? "")];
      }
      return [field, String(fieldValue ?? "")];
    }),
  );
}

export function getApiErrorState(error: unknown, fallbackMessage: string): ApiErrorState {
  if (!axios.isAxiosError(error)) {
    return { message: fallbackMessage, fieldErrors: {} };
  }

  const status = error.response?.status;
  if (status === 413) {
    return {
      code: "payload_too_large",
      message: "Arquivo muito grande. Reduza o tamanho da imagem (máximo 10 MB) e tente novamente.",
      fieldErrors: {},
    };
  }
  if (status === 429) {
    return {
      code: "throttled",
      message: "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
      fieldErrors: {},
    };
  }

  const data = error.response?.data;
  if (!data || typeof data !== "object") {
    return { message: fallbackMessage, fieldErrors: {} };
  }

  const semanticMessage =
    typeof data.message === "string"
      ? data.message
      : typeof data.detail === "string"
        ? data.detail
        : fallbackMessage;

  const fieldErrors = normalizeFieldErrors(
    "field_errors" in data ? data.field_errors : data,
  );

  return {
    code: typeof data.code === "string" ? data.code : undefined,
    message: semanticMessage,
    fieldErrors,
  };
}

export function isSessionExpiredError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;

  const status = error.response?.status;
  if (status === 401) return true;

  const code = error.response?.data && typeof error.response.data === "object"
    ? (error.response.data as { code?: unknown }).code
    : undefined;

  return code === "session_expired" || code === "session_invalidated" || code === "session_not_found";
}
