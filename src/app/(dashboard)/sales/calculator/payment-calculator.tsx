"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Badge,
  DefinitionList,
  StatCard,
  Table,
  TableShell,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/data-display";
import { FieldError, FormField, FormRow, Input, Select } from "@/components/ui/form-controls";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import {
  calculatePaymentPlan,
  unitPrice,
  type AmountMode,
  type AnnualTiming,
  type InstallmentFrequency,
} from "@/lib/payment-calculator";
import type { PricingSheetData } from "@/lib/pricing-sheet";
import { savePaymentPlanAction } from "./actions";
import { planSettingsSchema, type PlanSettings } from "./schema";

export interface CalculatorSale {
  id: string;
  reference: string;
  customer: string;
  unitCode: string;
  contractValue: number;
  currency: string;
  hasPlan: boolean;
  locked: boolean;
}

interface FormState {
  areaSqm: string;
  pricePerSqm: string;
  extras: string;
  contractMode: AmountMode;
  contractValue: string;
  downMode: AmountMode;
  downValue: string;
  annualRatePercent: string;
  annualTiming: AnnualTiming;
  frequency: InstallmentFrequency;
  termMonths: string;
  handoverMonth: string;
  targetPercent: string;
}

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function initialForm(defaults: PlanSettings, pricing: PricingSheetData | null): FormState {
  const firstArea = pricing?.areaOptions[0];
  return {
    areaSqm: String(firstArea?.areaSqm ?? ""),
    pricePerSqm: String(firstArea?.pricePerSqm ?? ""),
    extras: String(pricing?.extras.reduce((sum, extra) => sum + extra.amount, 0) ?? 0),
    contractMode: defaults.contract.mode,
    contractValue: String(defaults.contract.value),
    downMode: defaults.downPayment.mode,
    downValue: String(defaults.downPayment.value),
    annualRatePercent: String(defaults.annualRatePercent),
    annualTiming: defaults.annualTiming,
    frequency: defaults.frequency,
    termMonths: String(defaults.termMonths),
    handoverMonth: String(defaults.handoverMonth),
    targetPercent: String(defaults.targetPercent),
  };
}

const STATUS_TONE = { SAFE: "success", OUTSIDE: "warning", INVALID: "danger" } as const;
const STATUS_HINT = { SAFE: "Handover target met", OUTSIDE: "Below the handover target", INVALID: "Review the plan inputs" };

export function PaymentCalculator({
  defaults,
  pricing,
  currency,
  sales,
  canSavePlans,
}: {
  defaults: PlanSettings;
  pricing: PricingSheetData | null;
  currency: string;
  sales: CalculatorSale[];
  canSavePlans: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => initialForm(defaults, pricing));
  const [source, setSource] = useState<"LIST" | "SALE">("LIST");
  const [saleId, setSaleId] = useState(sales[0]?.id ?? "");
  const [saveState, setSaveState] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveState(null);
  };

  const sale = source === "SALE" ? sales.find((entry) => entry.id === saleId) : undefined;
  const money = (value: number) => formatMoney(value, sale?.currency ?? currency, { maximumFractionDigits: 2 });

  const settings: PlanSettings = {
    contract: { mode: form.contractMode, value: toNumber(form.contractValue) },
    downPayment: { mode: form.downMode, value: toNumber(form.downValue) },
    annualRatePercent: toNumber(form.annualRatePercent),
    annualTiming: form.annualTiming,
    frequency: form.frequency,
    termMonths: toNumber(form.termMonths),
    handoverMonth: toNumber(form.handoverMonth),
    targetPercent: toNumber(form.targetPercent),
  };
  const validation = planSettingsSchema.safeParse(settings);
  const totalPrice = sale
    ? sale.contractValue
    : unitPrice({ areaSqm: toNumber(form.areaSqm), pricePerSqm: toNumber(form.pricePerSqm), extras: toNumber(form.extras) });
  const result = calculatePaymentPlan({ ...settings, totalPrice });
  const status = validation.success ? result.handover.status : "INVALID";
  // A blank price-list quote is not an error yet; wait for the price before judging the plan.
  const awaitingPrice = !sale && totalPrice <= 0;
  const quarterly = form.frequency === "QUARTERLY";

  const onAreaChange = (value: string) => {
    const option = pricing?.areaOptions.find((entry) => String(entry.areaSqm) === value);
    setForm((current) => ({
      ...current,
      areaSqm: value,
      pricePerSqm: option ? String(option.pricePerSqm) : current.pricePerSqm,
    }));
  };

  const onSave = () => {
    if (!sale) return;
    startSaving(async () => {
      const response = await savePaymentPlanAction(sale.id, settings);
      setSaveState(response.ok ? { ok: true, message: response.message ?? "Saved." } : { ok: false, message: response.error });
      if (response.ok) router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>
            {pricing ? "Defaults come from the calculator sheet; every field can be adjusted for this quote." : "Enter the unit price and plan terms."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {sales.length > 0 ? (
            <FormField label="Price based on" htmlFor="calc-source">
              <Select id="calc-source" value={source} onChange={(event) => setSource(event.target.value as "LIST" | "SALE")}>
                <option value="LIST">Price list (area × price per m²)</option>
                <option value="SALE">Existing sale (contract value)</option>
              </Select>
            </FormField>
          ) : null}

          {source === "SALE" ? (
            <FormField label="Sale" htmlFor="calc-sale">
              <Select id="calc-sale" value={saleId} onChange={(event) => { setSaleId(event.target.value); setSaveState(null); }}>
                {sales.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.reference} · {entry.customer} · {entry.unitCode}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormRow className="sm:grid-cols-2 lg:grid-cols-2">
              <FormField label="Unit area (m²)" htmlFor="calc-area">
                {pricing && pricing.areaOptions.length > 0 ? (
                  <Select id="calc-area" value={form.areaSqm} onChange={(event) => onAreaChange(event.target.value)}>
                    {pricing.areaOptions.map((option) => (
                      <option key={option.areaSqm} value={String(option.areaSqm)}>
                        {formatNumber(option.areaSqm)} m²
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id="calc-area" type="number" min={0} value={form.areaSqm} onChange={(event) => set("areaSqm", event.target.value)} />
                )}
              </FormField>
              <FormField label={`Price per m² (${currency})`} htmlFor="calc-price">
                <Input id="calc-price" type="number" min={0} value={form.pricePerSqm} onChange={(event) => set("pricePerSqm", event.target.value)} />
              </FormField>
              <FormField
                label={pricing?.extras.length ? pricing.extras.map((extra) => extra.label).join(" + ") : `Add-ons (${currency})`}
                htmlFor="calc-extras"
                className="sm:col-span-2"
                hint={pricing?.priceNote ?? undefined}
              >
                <Input id="calc-extras" type="number" min={0} value={form.extras} onChange={(event) => set("extras", event.target.value)} />
              </FormField>
            </FormRow>
          )}

          <FormRow className="sm:grid-cols-2 lg:grid-cols-2">
            <FormField label="Contract payment" htmlFor="calc-contract" hint="% of the total price" error={validation.success ? undefined : validation.error.issues.find((issue) => issue.path[0] === "contract")?.message}>
              <div className="flex gap-2">
                <Input id="calc-contract" type="number" min={0} value={form.contractValue} onChange={(event) => set("contractValue", event.target.value)} />
                <Select aria-label="Contract payment mode" className="w-24" value={form.contractMode} onChange={(event) => set("contractMode", event.target.value as AmountMode)}>
                  <option value="PERCENT">%</option>
                  <option value="AMOUNT">{currency}</option>
                </Select>
              </div>
            </FormField>
            <FormField label="Down payment" htmlFor="calc-down" hint="% of the price after contract" error={validation.success ? undefined : validation.error.issues.find((issue) => issue.path[0] === "downPayment")?.message}>
              <div className="flex gap-2">
                <Input id="calc-down" type="number" min={0} value={form.downValue} onChange={(event) => set("downValue", event.target.value)} />
                <Select aria-label="Down payment mode" className="w-24" value={form.downMode} onChange={(event) => set("downMode", event.target.value as AmountMode)}>
                  <option value="PERCENT">%</option>
                  <option value="AMOUNT">{currency}</option>
                </Select>
              </div>
            </FormField>
            <FormField label="Annual payment (%)" htmlFor="calc-annual" hint="Of the opening balance at its due date">
              <Input id="calc-annual" type="number" min={0} max={100} value={form.annualRatePercent} onChange={(event) => set("annualRatePercent", event.target.value)} />
            </FormField>
            <FormField label="Annual payment timing" htmlFor="calc-timing" hint={form.annualTiming === "START" ? "Months 1, 13, 25…" : "Months 12, 24, 36…"}>
              <Select id="calc-timing" value={form.annualTiming} onChange={(event) => set("annualTiming", event.target.value as AnnualTiming)}>
                <option value="START">Start of year</option>
                <option value="END">End of year</option>
              </Select>
            </FormField>
            <FormField label="Installments" htmlFor="calc-frequency">
              <Select id="calc-frequency" value={form.frequency} onChange={(event) => set("frequency", event.target.value as InstallmentFrequency)}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </Select>
            </FormField>
            <FormField label="Term (months)" htmlFor="calc-term" error={validation.success ? undefined : validation.error.issues.find((issue) => issue.path[0] === "termMonths")?.message}>
              <Input id="calc-term" type="number" min={1} max={600} value={form.termMonths} onChange={(event) => set("termMonths", event.target.value)} />
            </FormField>
            <FormField label="Handover month" htmlFor="calc-handover" error={validation.success ? undefined : validation.error.issues.find((issue) => issue.path[0] === "handoverMonth")?.message}>
              <Input id="calc-handover" type="number" min={0} value={form.handoverMonth} onChange={(event) => set("handoverMonth", event.target.value)} />
            </FormField>
            <FormField label="Target at handover (%)" htmlFor="calc-target">
              {pricing && pricing.targetOptions.length > 1 ? (
                <Select id="calc-target" value={form.targetPercent} onChange={(event) => set("targetPercent", event.target.value)}>
                  {pricing.targetOptions.map((option) => (
                    <option key={option} value={String(option)}>{option}%</option>
                  ))}
                </Select>
              ) : (
                <Input id="calc-target" type="number" min={0} max={100} value={form.targetPercent} onChange={(event) => set("targetPercent", event.target.value)} />
              )}
            </FormField>
          </FormRow>

          {canSavePlans && sale ? (
            <div className="space-y-2 border-t border-border pt-4">
              {sale.locked ? (
                <p className="text-xs text-muted-foreground">Payments were already collected on this sale&apos;s installments, so its plan can&apos;t be replaced.</p>
              ) : sale.hasPlan ? (
                <p className="text-xs text-muted-foreground">This sale already has a payment plan. Saving replaces its installments.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Installments are dated monthly from the sale date; the contract and down payments are recorded as the plan&apos;s down payment.</p>
              )}
              <Button type="button" className="w-full" onClick={onSave} loading={saving} disabled={sale.locked || status === "INVALID"}>
                {saving ? null : <Save className="size-4" />}
                <span>{sale.hasPlan ? "Replace payment plan" : "Save as payment plan"}</span>
              </Button>
              {saveState ? (
                saveState.ok ? <p className="text-xs font-medium text-foreground">{saveState.message}</p> : <FieldError>{saveState.message}</FieldError>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <StatCard label="Total unit price" value={money(result.totalPrice)} hint={sale ? `Contract value of ${sale.reference}` : undefined} />
          <StatCard
            label={quarterly ? "Quarterly installment" : "Monthly installment"}
            value={money(quarterly ? result.quarterlyInstallment : result.monthlyInstallment)}
            hint={quarterly ? `${money(result.monthlyInstallment)} monthly equivalent` : undefined}
          />
          <StatCard label="Paid by handover" value={formatPercent(result.handover.paidPercent, 2)} hint={`Target ${formatPercent(settings.targetPercent, 0)}`} />
          <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-card">
            <p className="text-[13px] font-medium text-muted-foreground">Sales status</p>
            <div className="mt-2">
              {awaitingPrice ? (
                <Badge className="text-xs">Waiting for price</Badge>
              ) : (
                <Badge tone={STATUS_TONE[status]} dot className="text-xs">{status}</Badge>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {awaitingPrice
                ? "Enter the unit area and price per m²"
                : validation.success
                  ? STATUS_HINT[status]
                  : (validation.error.issues[0]?.message ?? STATUS_HINT.INVALID)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Contract & down payment</CardTitle></CardHeader>
            <CardContent>
              <DefinitionList
                items={[
                  { label: `Contract payment (${formatPercent(result.contractPercent, 2)})`, value: money(result.contractAmount) },
                  { label: `Down payment (${formatPercent(result.downPaymentPercent, 2)})`, value: money(result.downPaymentAmount) },
                  { label: "Paid at signing", value: money(result.contractAmount + result.downPaymentAmount) },
                  { label: "Balance to finance", value: money(result.financedBalance) },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Handover check · month {result.handover.month}</CardTitle></CardHeader>
            <CardContent>
              <DefinitionList
                items={[
                  { label: "Total paid by handover", value: money(result.handover.paidAmount) },
                  { label: "Target amount", value: money(result.handover.targetAmount) },
                  { label: "Difference vs target", value: <span className={result.handover.difference < 0 ? "text-destructive" : undefined}>{money(result.handover.difference)}</span> },
                  { label: "Balance after handover", value: money(result.handover.remainingBalance) },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Annual payments + installments until handover</CardTitle>
            <CardDescription>Year total = annual payment + all installments paid during that contract year.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableShell>
              <Table className="min-w-[540px]">
                <THead>
                  <TR><TH>Year</TH><TH align="right">Annual payment</TH><TH align="right">Installments</TH><TH align="right">Installments value</TH><TH align="right">Year total</TH></TR>
                </THead>
                <TBody>
                  {result.years.map((year) => (
                    <TR key={year.year}>
                      <TD className="font-medium">Year {year.year}</TD>
                      <TD align="right">{money(year.annualPayment)}</TD>
                      <TD align="right">{year.installmentsCount}</TD>
                      <TD align="right">{money(year.installmentsTotal)}</TD>
                      <TD align="right" className="font-medium">{money(year.totalPaid)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>After handover</CardTitle></CardHeader>
          <CardContent>
            <DefinitionList
              items={
                quarterly
                  ? [
                      { label: "Months remaining", value: formatNumber(result.afterHandover.monthsRemaining) },
                      { label: "Full quarterly installments", value: `${result.afterHandover.quarterlyCount} × ${money(result.quarterlyInstallment)}` },
                      { label: "Final partial period", value: `${result.afterHandover.partialMonths} month(s)` },
                      { label: "Final partial payment", value: money(result.afterHandover.partialPayment) },
                    ]
                  : [
                      { label: "Months remaining", value: formatNumber(result.afterHandover.monthsRemaining) },
                      { label: "Monthly installments", value: `${result.afterHandover.monthlyCount} × ${money(result.monthlyInstallment)}` },
                    ]
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment timeline · {result.timeline.length} months</CardTitle></CardHeader>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">Show month-by-month schedule</summary>
              <TableShell className="mt-3 max-h-[480px] overflow-auto">
                <Table>
                  <THead>
                    <TR><TH>Month</TH><TH align="right">Opening</TH><TH align="right">Annual due</TH><TH align="right">Installment</TH><TH align="right">Paid this month</TH><TH align="right">Paid %</TH><TH align="right">Closing</TH></TR>
                  </THead>
                  <TBody>
                    {result.timeline.map((row) => (
                      <TR key={row.month} className={row.month === result.handover.month ? "bg-muted/60" : undefined}>
                        <TD className="font-medium">{row.month}</TD>
                        <TD align="right">{money(row.openingBalance)}</TD>
                        <TD align="right">{row.annualDue > 0 ? money(row.annualDue) : "—"}</TD>
                        <TD align="right">{row.installmentPaid > 0 ? money(row.installmentPaid) : "—"}</TD>
                        <TD align="right">{money(row.totalPaid)}</TD>
                        <TD align="right">{formatPercent(row.cumulativePercent, 2)}</TD>
                        <TD align="right">{money(row.closingBalance)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableShell>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
