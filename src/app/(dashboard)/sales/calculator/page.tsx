import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { asPricingSheetData } from "@/lib/pricing-sheet";
import { PaymentCalculator, type CalculatorSale } from "./payment-calculator";
import { RefreshPricingButton } from "./refresh-pricing-button";
import type { PlanSettings } from "./schema";

export const metadata = { title: "Payment Calculator" };

/** Used until a calculator sheet is connected in Settings. */
const FALLBACK_SETTINGS: PlanSettings = {
  contract: { mode: "PERCENT", value: 5 },
  downPayment: { mode: "PERCENT", value: 15 },
  annualRatePercent: 10,
  annualTiming: "START",
  frequency: "MONTHLY",
  termMonths: 100,
  handoverMonth: 36,
  targetPercent: 60,
};

export default async function PaymentCalculatorPage() {
  const context = await requirePermission("sales.view");
  const canSavePlans = hasPermission(context.permissions, "payments.manage");
  const canConnectSheet = hasPermission(context.permissions, "settings.manage");

  const [settings, saleRows] = await Promise.all([
    context.db.organizationSettings.findUnique({
      where: { organizationId: context.organizationId },
      select: { pricingSheetUrl: true, pricingSheetData: true, pricingSheetSyncedAt: true },
    }),
    canSavePlans
      ? context.db.sale.findMany({
          where: { status: { not: "CANCELLED" } },
          orderBy: { saleDate: "desc" },
          take: 200,
          select: {
            id: true,
            reference: true,
            contractValue: true,
            currency: true,
            lead: { select: { firstName: true, lastName: true } },
            unit: { select: { unitCode: true } },
            paymentPlan: {
              select: {
                id: true,
                installments: { where: { paidAmount: { gt: 0 } }, select: { id: true }, take: 1 },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const pricing = settings?.pricingSheetUrl ? asPricingSheetData(settings.pricingSheetData) : null;
  const defaults: PlanSettings = pricing
    ? {
        contract: pricing.contract,
        downPayment: pricing.downPayment,
        annualRatePercent: pricing.annualRatePercent,
        annualTiming: pricing.annualTiming,
        frequency: pricing.frequency,
        termMonths: pricing.termMonths,
        handoverMonth: pricing.handoverMonth,
        targetPercent: pricing.targetPercent,
      }
    : FALLBACK_SETTINGS;

  const sales: CalculatorSale[] = saleRows.map((sale) => ({
    id: sale.id,
    reference: sale.reference,
    customer: `${sale.lead.firstName} ${sale.lead.lastName}`.trim(),
    unitCode: sale.unit.unitCode,
    contractValue: Number(sale.contractValue),
    currency: sale.currency,
    hasPlan: Boolean(sale.paymentPlan),
    locked: Boolean(sale.paymentPlan?.installments.length),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Calculator"
        description={
          pricing?.title
            ? `${pricing.title}: contract + down payment, annual dues and installments, with the handover collection check.`
            : "Contract + down payment, annual dues and installments, with the handover collection check."
        }
        breadcrumbs={[{ label: "Reservations & Sales", href: "/sales" }, { label: "Payment Calculator" }]}
        actions={
          settings?.pricingSheetUrl ? (
            <RefreshPricingButton
              lastReadLabel={settings.pricingSheetSyncedAt ? formatDateTime(settings.pricingSheetSyncedAt) : null}
            />
          ) : canConnectSheet ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/settings#pricing-sheet">
                <FileSpreadsheet className="size-4" />
                <span>Connect calculator sheet</span>
              </Link>
            </Button>
          ) : null
        }
      />

      <PaymentCalculator
        key={settings?.pricingSheetSyncedAt?.toISOString() ?? "default"}
        defaults={defaults}
        pricing={pricing}
        currency={context.currency}
        sales={sales}
        canSavePlans={canSavePlans}
      />
    </div>
  );
}
