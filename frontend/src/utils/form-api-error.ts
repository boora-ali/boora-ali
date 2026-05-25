import { toast } from "sonner";
import type { FieldValues, UseFormSetError } from "react-hook-form";
import { getApiErrorState, type ApiErrorState } from "../services/api-errors";
import { applyApiErrors } from "./form-errors";

type ReportApiErrorOptions<T extends FieldValues> = {
  setError?: UseFormSetError<T>;
  error: unknown,
  fallbackMessage: string,
  mapMessage?: (apiError: ApiErrorState) => string,
  onMessage?: (message: string) => void,
};

export function reportApiError<T extends FieldValues>({
  setError,
  error,
  fallbackMessage,
  mapMessage,
  onMessage,
}: ReportApiErrorOptions<T>) {
  const apiError = getApiErrorState(error, fallbackMessage);
  const message = mapMessage ? mapMessage(apiError) : apiError.message;
  toast.error(message);
  onMessage?.(message);
  if (setError) {
    setError("root", { message });
    applyApiErrors(setError, apiError.fieldErrors);
  }
  return apiError;
}
