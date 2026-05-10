export const LOADING_EVENT = "api:loading";

let _count = 0;

export function notifyLoading(delta: 1 | -1) {
  _count = Math.max(0, _count + delta);
  window.dispatchEvent(new CustomEvent(LOADING_EVENT, { detail: _count }));
}
