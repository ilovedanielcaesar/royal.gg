export function publicAppUrl(path: string): string {
  const configuredBase = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  // Dev and preview deploys may leave this unset, so use their live origin.
  const base = (configuredBase || window.location.origin).replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}
