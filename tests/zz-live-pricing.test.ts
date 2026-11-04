import { it } from "vitest";
import { readPricingSheet } from "@/lib/pricing-sheet";
import { calculatePaymentPlan, unitPrice } from "@/lib/payment-calculator";

it("reads the live calculator sheet", async () => {
  const data = await readPricingSheet("https://docs.google.com/spreadsheets/d/171Gx__a4AaBotL3ekC0O5LIpEQd4k5yN");
  console.log(JSON.stringify(data, null, 2));
  for (const option of data.areaOptions) {
    const total = unitPrice({ areaSqm: option.areaSqm, pricePerSqm: option.pricePerSqm, extras: data.extras.reduce((s, e) => s + e.amount, 0) });
    const r = calculatePaymentPlan({ ...data, totalPrice: total });
    console.log(option.areaSqm, total, r.monthlyInstallment.toFixed(2), r.handover.paidPercent.toFixed(2), r.handover.status);
  }
}, 60000);
