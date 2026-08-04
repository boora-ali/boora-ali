import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { visitsService } from "../services/visits.service";
import { visitItemsService } from "../services/visit-items.service";
import { VisitForm } from "../components/visits/VisitForm";
import { BackButton } from "../components/ui/BackButton";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";

export default function NewVisitPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useTranslation();
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChangesWarning(isDirty);

  return (
    <div className="max-w-xl mx-auto p-4">
      <BackButton fallbackTo={`/places/${id}`} onBeforeNavigate={() => !isDirty || window.confirm(t("common.unsavedChanges"))} />
      <h1 className="text-2xl font-bold mb-4">{t("visitForm.newTitle")}</h1>
      <VisitForm
        onDirtyChange={setIsDirty}
        onSubmit={async (visit, items) => {
          const created = await visitsService.create(id!, visit);
          const itemResults = await Promise.allSettled(
            items.map((item) => visitItemsService.create(created.public_id, item)),
          );
          const failedItem = itemResults.find((result) => result.status === "rejected");
          if (failedItem?.status === "rejected") {
            await visitsService.remove(created.public_id).catch(() => {});
            throw failedItem.reason;
          }
          nav(`/places/${id}`, { replace: true });
        }}
      />
    </div>
  );
}
