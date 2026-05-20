import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collectionsService, type Collection } from "../services/collections.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "../components/ui/LoadingState";
import { BackButton } from "../components/ui/BackButton";
import { ErrorMessage } from "../components/ui/ErrorMessage";

export default function CollectionListPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<{
    status: "idle" | "loading" | "error";
    data: Collection[] | null;
  }>({ status: "idle", data: null });
  const loaded = useRef(false);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📍");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    collectionsService
      .list()
      .then((data) => setState({ status: "idle", data }))
      .catch(() => setState({ status: "error", data: null }));

    setState({ status: "loading", data: null });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await collectionsService.create({
        name: newName.trim(),
        emoji: newEmoji.trim() || "📍",
        description: newDescription.trim(),
      });
      setState((prev) => ({
        status: "idle",
        data: prev.data ? [...prev.data, created] : [created],
      }));
      setNewName("");
      setNewEmoji("📍");
      setNewDescription("");
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  }

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error")
    return (
      <div className="max-w-2xl mx-auto p-4">
        <ErrorMessage message={t("common.loading")} />
      </div>
    );

  const collections = state.data ?? [];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <BackButton />
      <div className="flex items-center justify-between">
        <h1 className="font-fraunces text-3xl font-bold text-text">{t("collections.title")}</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {t("collections.new")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  className="w-14 rounded-lg border border-border bg-background px-2 py-2 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={4}
                  aria-label="emoji"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("collections.title")}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t("collections.title")}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={creating}>
                  {t("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {collections.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">{t("collections.empty")}</p>
      ) : (
        <div className="space-y-2">
          {collections.map((c) => (
            <Link key={c.public_id} to={`/collections/${c.public_id}`}>
              <Card className="hover:bg-surface/60 transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text truncate">{c.name}</p>
                      {c.description && (
                        <p className="text-sm text-muted truncate">{c.description}</p>
                      )}
                    </div>
                    <span className="text-sm text-muted shrink-0">
                      {c.place_count} {t("collections.places_count")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
