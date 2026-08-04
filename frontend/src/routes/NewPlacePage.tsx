import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { placesService } from "../services/places.service";
import { PlaceForm } from "../components/places/PlaceForm";
import { BackButton } from "../components/ui/BackButton";
import { notifyPlacesChanged } from "../utils/places-state";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";

export default function NewPlacePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChangesWarning(isDirty);
  return (
    <div className="max-w-xl mx-auto p-4">
      <BackButton onBeforeNavigate={() => !isDirty || window.confirm(t("common.unsavedChanges"))} />
      <h1 className="font-fraunces text-2xl font-bold mb-4 text-text">{t("newPlace.title")}</h1>
      <PlaceForm
        onDirtyChange={setIsDirty}
        onSubmit={async (d) => {
          const p = await placesService.create(d);
          notifyPlacesChanged();
          nav(`/places/${p.public_id}`, { replace: true });
        }}
      />
    </div>
  );
}
