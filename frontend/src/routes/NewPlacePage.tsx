import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { placesService } from "../services/places.service";
import { PlaceForm } from "../components/places/PlaceForm";
import { BackButton } from "../components/ui/BackButton";
import { notifyPlacesChanged } from "../utils/places-state";

export default function NewPlacePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="max-w-xl mx-auto p-4">
      <BackButton />
      <h1 className="font-fraunces text-2xl font-bold mb-4 text-text">{t("newPlace.title")}</h1>
      <PlaceForm
        onSubmit={async (d) => {
          const p = await placesService.create(d);
          notifyPlacesChanged();
          nav(`/places/${p.public_id}`, { replace: true });
        }}
      />
    </div>
  );
}
