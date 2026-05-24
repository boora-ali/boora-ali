import { useCallback, useEffect, useRef, useState } from "react";

export function useImagePreview(initialPreview: string | null = null) {
  const [preview, setPreviewState] = useState<string | null>(initialPreview);
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const setPreview = useCallback(
    (nextPreview: string | null) => {
      revokeObjectUrl();
      setPreviewState(nextPreview);
    },
    [revokeObjectUrl],
  );

  const setPreviewFromFile = useCallback(
    (file: File | null, fallback: string | null = initialPreview) => {
      revokeObjectUrl();
      if (!file) {
        setPreviewState(fallback);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setPreviewState(objectUrl);
    },
    [initialPreview, revokeObjectUrl],
  );

  const clearPreview = useCallback(() => {
    setPreview(null);
  }, [setPreview]);

  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  return {
    preview,
    setPreview,
    setPreviewFromFile,
    clearPreview,
  };
}
