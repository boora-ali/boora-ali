import { useEffect, useState } from "react";
import { LOADING_EVENT } from "./loading-events";

export function GlobalLoadingBar() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      setActive((e as CustomEvent<number>).detail > 0);
    }
    window.addEventListener(LOADING_EVENT, handler);
    return () => window.removeEventListener(LOADING_EVENT, handler);
  }, []);

  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-primary/20 overflow-hidden">
      <div className="h-full bg-primary animate-loading-bar" />
    </div>
  );
}
