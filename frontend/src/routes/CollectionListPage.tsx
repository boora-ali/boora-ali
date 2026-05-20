import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collectionsService, type Collection } from "../services/collections.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoadingState } from "../components/ui/LoadingState";
import { BackButton } from "../components/ui/BackButton";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Trash2, ChevronRight, FolderOpen } from "lucide-react";

export default function CollectionListPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<{
    status: "idle" | "loading" | "error";
    data: Collection[] | null;
  }>({ status: "loading", data: null });

  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📍");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    collectionsService
      .list()
      .then((data) => setState({ status: "idle", data }))
      .catch(() => setState({ status: "error", data: null }));
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
        <ErrorMessage message={t("common.error")} />
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
                placeholder={t("collections.description_placeholder")}
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
        <div className="flex flex-col items-center gap-3 py-16 text-center animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-border">
            <FolderOpen className="h-7 w-7 text-muted" />
          </div>
          <div>
            <p className="font-fraunces text-lg font-semibold text-text">{t("collections.empty")}</p>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)}>{t("collections.new")}</Button>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface overflow-hidden">
          {collections.map((c) => (
            <div key={c.public_id} className="flex items-center group">
              <Link
                to={`/collections/${c.public_id}`}
                className="flex flex-1 min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-background"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background border border-border text-xl">
                  {c.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text truncate leading-snug">{c.name}</p>
                  {c.description ? (
                    <p className="text-xs text-muted truncate mt-0.5">{c.description}</p>
                  ) : (
                    <p className="text-xs text-muted mt-0.5">
                      {c.place_count} {t("collections.places_count")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.description && (
                    <span className="text-xs text-muted">{c.place_count} {t("collections.places_count")}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted/50" />
                </div>
              </Link>
              <button
                type="button"
                title={t("collections.delete")}
                onClick={() => setDeleteTarget(c)}
                className="shrink-0 p-3 text-muted hover:text-destructive transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("collections.delete")}</DialogTitle>
            <DialogDescription>{t("collections.delete_confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                try {
                  await collectionsService.delete(deleteTarget.public_id);
                  setState((prev) => ({
                    ...prev,
                    data: prev.data
                      ? prev.data.filter((x) => x.public_id !== deleteTarget.public_id)
                      : null,
                  }));
                  setDeleteTarget(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {t("collections.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
