import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sanitizeUrl } from "../../utils/url";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  latitude: string;
  longitude: string;
  mapsUrl?: string;
};

export function MapModal({ open, onClose, name, latitude, longitude, mapsUrl }: Props) {
  const embedUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              title={name}
              src={embedUrl}
              width="100%"
              height="320"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block"
            />
          </div>
          {sanitizeUrl(mapsUrl) && (
            <a
              href={sanitizeUrl(mapsUrl)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Abrir no Google Maps
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
