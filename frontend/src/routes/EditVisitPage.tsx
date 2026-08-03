import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { visitsService } from "../services/visits.service";
import { visitItemsService } from "../services/visit-items.service";
import { VisitForm } from "../components/visits/VisitForm";
import { BackButton } from "../components/ui/BackButton";
import type { Visit } from "../types/visit";
import { PageState } from "../components/ui/PageState";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
type LocationState = { visit?: Visit; placePublicId?: string };

export default function EditVisitPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useTranslation();
  const state = (useLocation().state ?? {}) as LocationState;
  const [visit, setVisit] = useState<Visit | null>(
    state.visit?.items !== undefined ? state.visit : null
  );
  const [loading, setLoading] = useState(!visit);
  const [loadError, setLoadError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    let cancelled = false;

    async function loadVisit() {
      if (state.visit?.items !== undefined) {
        setVisit(state.visit);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const loaded = await visitsService.get(id!);
        if (!cancelled) {
          setVisit(loaded);
        }
      } catch {
        if (!cancelled) {
          setLoadError(t("visitForm.loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadVisit();

    return () => {
      cancelled = true;
    };
  }, [id, state.visit, t]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <BackButton onBeforeNavigate={() => !isDirty || window.confirm(t("common.unsavedChanges"))} />
      <PageState loading={loading} error={loadError}>
        <>
          <h1 className="text-2xl font-bold mb-4">{t("visitForm.editTitle")}</h1>
          <VisitForm
            initial={visit ?? undefined}
            initialItems={visit?.items ?? []}
            onDirtyChange={setIsDirty}
            onSubmit={async (visitData, items) => {
              const previousItems = visit?.items ?? [];
              const itemIds = new Set(items.flatMap((item) => item.public_id ? [item.public_id] : []));
              await Promise.all([
                visitsService.update(id!, visitData),
                ...items.map(({ public_id, visit: _visit, created_at: _createdAt, updated_at: _updatedAt, ...item }) => public_id
                  ? visitItemsService.update(public_id, item)
                  : visitItemsService.create(id!, item)),
                ...previousItems
                  .filter((item) => !itemIds.has(item.public_id))
                  .map((item) => visitItemsService.remove(item.public_id)),
              ]);
              nav(state.placePublicId ? `/places/${state.placePublicId}` : "/places", { replace: true });
            }}
          />
        </>
      </PageState>
    </div>
  );
}
