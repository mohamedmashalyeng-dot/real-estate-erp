import { z } from "zod";

const amountSchema = z.object({
  mode: z.enum(["PERCENT", "AMOUNT"]),
  value: z.number().finite().nonnegative(),
});

/** Plan settings sent by the calculator; the price always comes from the sale on the server. */
export const planSettingsSchema = z
  .object({
    contract: amountSchema,
    downPayment: amountSchema,
    annualRatePercent: z.number().finite().min(0).max(100),
    annualTiming: z.enum(["START", "END"]),
    frequency: z.enum(["MONTHLY", "QUARTERLY"]),
    termMonths: z.number().int().min(1, "Term must be at least 1 month.").max(600),
    handoverMonth: z.number().int().min(0),
    targetPercent: z.number().finite().min(0).max(100),
  })
  .refine((value) => value.handoverMonth <= value.termMonths, {
    message: "Handover month cannot be after the end of the term.",
    path: ["handoverMonth"],
  })
  .refine((value) => value.contract.mode !== "PERCENT" || value.contract.value <= 100, {
    message: "Contract payment cannot exceed 100%.",
    path: ["contract"],
  })
  .refine((value) => value.downPayment.mode !== "PERCENT" || value.downPayment.value <= 100, {
    message: "Down payment cannot exceed 100%.",
    path: ["downPayment"],
  });

export type PlanSettings = z.infer<typeof planSettingsSchema>;
