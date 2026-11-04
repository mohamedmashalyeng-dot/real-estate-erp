import { AppError } from "./errors";
import { fetchSheetCsv, listSheetTabs, parseCsv, parseSpreadsheetId } from "./google-sheets";
import type { AmountMode, AnnualTiming, InstallmentFrequency } from "./payment-calculator";

/**
 * Reads unit prices and payment-plan defaults from the sales calculator sheet
 * ("WEST Sales Payment Calculator" layout). Rows are found by their label in
 * column A, so moving rows around in the sheet does not break the import.
 * The parsed snapshot is stored in OrganizationSettings.pricingSheetData.
 */

export interface PricingAreaOption {
  areaSqm: number;
  pricePerSqm: number;
}

export interface PricingSheetData {
  title: string | null;
  areaOptions: PricingAreaOption[];
  /** Fixed add-ons between "Price per m²" and "TOTAL UNIT PRICE" (e.g. elevator + garage). */
  extras: { label: string; amount: number }[];
  /** Free-text note next to the price, shown to sales so pricing assumptions stay visible. */
  priceNote: string | null;
  contract: { mode: AmountMode; value: number };
  downPayment: { mode: AmountMode; value: number };
  annualRatePercent: number;
  annualTiming: AnnualTiming;
  frequency: InstallmentFrequency;
  termMonths: number;
  handoverMonth: number;
  targetPercent: number;
  targetOptions: number[];
}

const LABELS = {
  unitArea: "unitarea",
  pricePerSqm: "priceperm",
  totalPrice: "totalunitprice",
  contract: "contractpayment",
  downPayment: "downpayment",
  annualRate: "annualpaymentrate",
  annualTiming: "annualpaymenttiming",
  frequency: "installmentfrequency",
  term: "totalinstallmentterm",
  handover: "handovermonth",
  target: "minimumcollectiontarget",
} as const;

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Accepts "25,000.00", "25٬000٫00", Arabic-Indic digits, "10%" and "EGP 200,000". */
export function parseSheetNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const text = raw
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");
  const match = /-?\d+(?:\.\d+)?/.exec(text);
  return match ? Number(match[0]) : null;
}

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(",", "")));
}

/** "168 m² = 25,000; 170/180 m² = 24,000 assumed" → {168: 25000, 170: 24000, 180: 24000} */
function pricesFromNote(note: string): Map<number, number> {
  const prices = new Map<number, number>();
  for (const match of note.matchAll(/(\d+(?:\s*\/\s*\d+)*)\s*m²?\s*=\s*([\d.,٬٫]+)/gi)) {
    const price = parseSheetNumber(match[2]);
    if (price === null) continue;
    for (const area of match[1].split("/")) prices.set(Number(area.trim()), price);
  }
  return prices;
}

export function parsePricingSheet(rows: string[][]): PricingSheetData {
  const labels = rows.map((row) => normalizeLabel(row[0] ?? ""));
  const find = (key: string) => labels.findIndex((label) => label.startsWith(key));
  const cell = (rowIndex: number, column: number) => (rowIndex >= 0 ? (rows[rowIndex][column] ?? "").trim() : "");

  const missing: string[] = [];
  const required = (key: keyof typeof LABELS, column: number, label: string) => {
    const value = parseSheetNumber(cell(find(LABELS[key]), column));
    if (value === null) missing.push(label);
    return value ?? 0;
  };

  const areaRow = find(LABELS.unitArea);
  const priceRow = find(LABELS.pricePerSqm);
  const totalRow = find(LABELS.totalPrice);
  const selectedArea = required("unitArea", 1, "Unit area (m²)");
  const selectedPrice = required("pricePerSqm", 1, "Price per m²");

  const prices = pricesFromNote(cell(priceRow, 2));
  if (selectedArea > 0 && selectedPrice > 0) prices.set(selectedArea, selectedPrice);
  const areas = new Set([...numbersIn(cell(areaRow, 2)), ...prices.keys()]);
  const areaOptions = [...areas]
    .filter((area) => prices.has(area))
    .sort((a, b) => a - b)
    .map((area) => ({ areaSqm: area, pricePerSqm: prices.get(area)! }));

  const extras: PricingSheetData["extras"] = [];
  if (priceRow >= 0 && totalRow > priceRow) {
    for (let index = priceRow + 1; index < totalRow; index++) {
      const amount = parseSheetNumber(cell(index, 1));
      if (cell(index, 0) && amount !== null) extras.push({ label: cell(index, 0), amount });
    }
  }

  const mode = (rowIndex: number): AmountMode => (/percent|%|نسبة/i.test(cell(rowIndex, 1)) ? "PERCENT" : "AMOUNT");
  const contractRow = find(LABELS.contract);
  const downRow = find(LABELS.downPayment);
  const contractValue = parseSheetNumber(cell(contractRow, 2));
  const downValue = parseSheetNumber(cell(downRow, 2));
  if (contractValue === null) missing.push("Contract payment");
  if (downValue === null) missing.push("Down payment");

  const timingText = cell(find(LABELS.annualTiming), 1);
  const frequencyText = cell(find(LABELS.frequency), 1);
  if (!timingText) missing.push("Annual payment timing");
  if (!frequencyText) missing.push("Installment frequency");

  const targetRow = find(LABELS.target);
  const targetPercent = required("target", 1, "Minimum collection target (%)");
  const data: PricingSheetData = {
    title: cell(0, 0) || null,
    areaOptions,
    extras,
    priceNote: cell(priceRow, 2) || null,
    contract: { mode: mode(contractRow), value: contractValue ?? 0 },
    downPayment: { mode: mode(downRow), value: downValue ?? 0 },
    annualRatePercent: required("annualRate", 1, "Annual payment rate (%)"),
    annualTiming: /end|نهاية/i.test(timingText) ? "END" : "START",
    frequency: /quarter|ربع/i.test(frequencyText) ? "QUARTERLY" : "MONTHLY",
    termMonths: required("term", 1, "Total installment term (months)"),
    handoverMonth: required("handover", 1, "Handover month"),
    targetPercent,
    targetOptions: [...new Set([...numbersIn(cell(targetRow, 2)), targetPercent])].sort((a, b) => b - a),
  };

  if (missing.length > 0) {
    throw new AppError(`The calculator sheet is missing these rows or values: ${missing.join(", ")}.`, {
      code: "pricing_sheet_invalid",
      status: 422,
    });
  }
  return data;
}

export async function readPricingSheet(sheetUrl: string): Promise<PricingSheetData> {
  const spreadsheetId = parseSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new AppError("That is not a Google Sheets link.", { code: "sheet_invalid_url", status: 422 });
  }
  const tabs = await listSheetTabs(spreadsheetId);
  // Try the tab named like "Calculator" first, then the others.
  const ordered = [...tabs].sort((a, b) => Number(/calc/i.test(b.name)) - Number(/calc/i.test(a.name)));
  let lastError: unknown;
  for (const tab of ordered) {
    try {
      return parsePricingSheet(parseCsv(await fetchSheetCsv(spreadsheetId, tab.gid)));
    } catch (error) {
      if (error instanceof AppError && error.code !== "pricing_sheet_invalid") throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** Narrows the stored JSON snapshot; returns null for anything unexpected. */
export function asPricingSheetData(value: unknown): PricingSheetData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<PricingSheetData>;
  return Array.isArray(data.areaOptions) && typeof data.termMonths === "number" && data.contract
    ? (data as PricingSheetData)
    : null;
}
