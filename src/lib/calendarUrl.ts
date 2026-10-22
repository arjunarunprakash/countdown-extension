// Calendar subscription links (Google "Secret address in iCal format",
// Apple "Public calendar" webcal links, Outlook published calendars).

export type UrlResult = { url: URL } | { error: string };

export function normalizeCalendarUrl(input: string): UrlResult {
  let text = input.trim();
  if (!text) return { error: "Paste a calendar link first." };
  // webcal:// is just https:// for calendar apps.
  text = text.replace(/^webcals?:\/\//i, "https://");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: "That doesn't look like a link." };
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return { error: "Use an https:// or webcal:// calendar link." };
  if (!url.hostname.includes(".")) return { error: "That doesn't look like a calendar link." };
  return { url };
}

/**
 * Host permissions to request for a calendar link: its own host, plus
 * subdomains of its parent domain, since calendar servers often redirect to
 * a sibling host (e.g. iCloud's pNN-caldav.icloud.com). Uses the last two
 * labels as the parent, which is right for the common providers.
 */
export function permissionOrigins(url: URL): string[] {
  const host = url.hostname;
  const labels = host.split(".");
  const isIp = /^[\d.]+$/.test(host) || host.includes(":");
  const origins = [`https://${host}/*`];
  if (!isIp && labels.length > 2) origins.push(`https://*.${labels.slice(-2).join(".")}/*`);
  return origins;
}

export const MAX_CALENDAR_BYTES = 10 * 1024 * 1024;
