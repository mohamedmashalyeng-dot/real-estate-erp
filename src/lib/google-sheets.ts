import { AppError } from "./errors";

/**
 * Read-only access to *public* Google Sheets ("Anyone with the link can
 * view"). No API key or OAuth is involved: tabs are exported as CSV through
 * the same endpoints the Sheets UI uses for "File > Download".
 */

const FETCH_TIMEOUT_MS = 15_000;

export interface SheetTab {
  name: string;
  /** Tab id from the URL (`#gid=...`). Undefined means "first tab". */
  gid?: string;
}

export function parseSpreadsheetId(url: string): string | null {
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(url.trim());
  return match ? match[1] : null;
}

async function fetchText(url: string): Promise<{ text: string; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[google-sheets] fetch failed", { url, error: error instanceof Error ? error.message : String(error) });
    throw new AppError("Could not reach Google Sheets. Check the server's internet connection and try again.", {
      code: "sheet_unreachable",
      status: 502,
    });
  }
  if (!response.ok) {
    throw new AppError(
      response.status === 404
        ? "Google Sheet not found. Check the link."
        : `Google Sheets responded with HTTP ${response.status}.`,
      { code: "sheet_unavailable", status: 502 },
    );
  }
  return { text: await response.text(), contentType: response.headers.get("content-type") ?? "" };
}

function decodeJsString(value: string): string {
  return value
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\(.)/g, "$1");
}

/**
 * Lists the tabs of a public spreadsheet. The CSV export only serves one tab
 * per request, so the tab ids are read from the public HTML view. If Google
 * changes that page, this falls back to the first tab only.
 */
export async function listSheetTabs(spreadsheetId: string): Promise<SheetTab[]> {
  const { text } = await fetchText(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`);
  const tabs: SheetTab[] = [];
  const pattern = /\{name: "((?:[^"\\]|\\.)*)",[^}]*?gid: "(\d+)"/g;
  for (const match of text.matchAll(pattern)) {
    if (!tabs.some((tab) => tab.gid === match[2])) {
      tabs.push({ name: decodeJsString(match[1]), gid: match[2] });
    }
  }
  return tabs.length > 0 ? tabs : [{ name: "Sheet1" }];
}

export async function fetchSheetCsv(spreadsheetId: string, gid?: string): Promise<string> {
  const query = gid ? `format=csv&gid=${gid}` : "format=csv";
  const { text, contentType } = await fetchText(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${query}`,
  );
  // Private sheets redirect to the Google sign-in page instead of a CSV.
  if (!contentType.includes("text/csv")) {
    throw new AppError(
      'This Google Sheet is not public. In Google Sheets choose Share → General access → "Anyone with the link" (Viewer), then try again.',
      { code: "sheet_not_public", status: 403 },
    );
  }
  return text;
}

/** RFC 4180 CSV parser (quoted fields may contain commas, quotes and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
