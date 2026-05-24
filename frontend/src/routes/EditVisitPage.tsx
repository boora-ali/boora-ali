import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { visitsService } from "../services/visits.service";
import { visitItemsService } from "../services/visit-items.service";
import { VisitForm } from "../components/visits/VisitForm";
import { BackButton } from "../components/ui/BackButton";
import type { Visit } from "../types/visit";
import { PageState } from "../components/ui/PageState";
type LocationState = { visit?: Visit };

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
      <BackButton />
      <PageState loading={loading} error={loadError}>
        <>
          <h1 className="text-2xl font-bold mb-4">{t("visitForm.editTitle")}</h1>
          <VisitForm
            initial={visit ?? undefined}
            initialItems={visit?.items ?? []}
            onItemSave={async (itemData, currentItem) => {
              if (currentItem?.public_id) {
                return visitItemsService.update(currentItem.public_id, itemData);
              }

              return visitItemsService.create(id!, itemData);
            }}
            onSubmit={async (visitData) => {
              await visitsService.update(id!, visitData);
              nav(-1);
            }}
          />
        </>
      </PageState>
    </div>
  );
}
