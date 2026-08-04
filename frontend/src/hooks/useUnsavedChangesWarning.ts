import { useBeforeUnload } from "react-router";

export function useUnsavedChangesWarning(isDirty: boolean) {
  useBeforeUnload((event) => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}
