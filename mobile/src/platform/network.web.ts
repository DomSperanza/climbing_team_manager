// Online/offline for the web version, from the browser's own events.

export function watchOnline(onChange: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const on = () => onChange(true);
  const off = () => onChange(false);
  onChange(navigator.onLine);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
}
