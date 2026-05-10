import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { visitsService } from "../services/visits.service";
import { visitItemsService } from "../services/visit-items.service";
import { VisitForm } from "../components/visits/VisitForm";
import { BackButton } from "../components/ui/BackButton";

export default function NewVisitPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="max-w-xl mx-auto p-4">
      <BackButton fallbackTo={`/places/${id}`} />
      <h1 className="text-2xl font-bold mb-4">{t("visitForm.newTitle")}</h1>
      <VisitForm
        onSubmit={async (visit, items) => {
          const created = await visitsService.create(id!, visit);
          for (const it of items) {
            await visitItemsService.create(created.public_id, it);
          }
          nav(`/places/${id}`, { replace: true });
        }}
      />
    </div>
  );
}
