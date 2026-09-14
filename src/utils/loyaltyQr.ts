const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Meal/drink codes may be a raw UUID (app scanner, older stickers) or a
 * website URL (phone camera): https://nuxapp.de/scan/{uuid}
 */
export function normalizeLoyaltyQrPayload(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  try {
    const withProto = /^https?:\/\//i.test(s)
      ? s
      : `https://nuxapp.de${s.startsWith("/") ? s : `/${s}`}`;
    const url = new URL(withProto);
    const fromPath = url.pathname.match(
      /\/scan\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/)?$/i,
    );
    const uuid = fromPath?.[1];
    if (uuid) return uuid.toLowerCase();
  } catch {
    // not a URL
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return s.toLowerCase();
  }

  const embedded = s.match(UUID_RE);
  if (embedded && /\/scan\//i.test(s)) return embedded[0].toLowerCase();

  return s;
}
