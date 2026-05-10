import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

export function applyApiErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string>,
) {
  for (const [field, msg] of Object.entries(fieldErrors)) {
    setError(field as Path<T>, { type: "server", message: msg });
  }
}
