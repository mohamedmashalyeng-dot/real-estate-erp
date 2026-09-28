import { z } from "zod";
import { LEAD_SOURCES, LEAD_STAGES } from "@/lib/constants";
import type {
  FollowUpStatus,
  FollowUpType,
  LeadSource,
  LeadStage,
  LeadTemperature,
  Priority,
} from "@/generated/prisma/enums";

export const LEAD_STAGE_VALUES = LEAD_STAGES as unknown as [LeadStage, ...LeadStage[]];
export const LEAD_SOURCE_VALUES = LEAD_SOURCES as unknown as [LeadSource, ...LeadSource[]];
export const LEAD_TEMPERATURE_VALUES = ["HOT", "WARM", "COLD"] as unknown as [
  LeadTemperature,
  ...LeadTemperature[],
];
export const FOLLOW_UP_TYPE_VALUES = ["CALL", "MEETING", "EMAIL", "WHATSAPP", "VIEWING", "OTHER"] as unknown as [
  FollowUpType,
  ...FollowUpType[],
];
export const FOLLOW_UP_STATUS_VALUES = ["COMPLETED", "MISSED", "CANCELLED"] as unknown as [
  FollowUpStatus,
  ...FollowUpStatus[],
];
export const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as unknown as [
  Priority,
  ...Priority[],
];

export const createLeadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Phone is required.")
    .max(32)
    .regex(/^[+0-9][0-9\s()-]*$/, "Enter a valid phone number."),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine((value) => value === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Enter a valid email address.",
    }),
  country: z.string().trim().max(64).optional(),
  city: z.string().trim().max(64).optional(),
  budgetMin: z.coerce.number().nonnegative().max(999_999_999_999).optional(),
  budgetMax: z.coerce.number().nonnegative().max(999_999_999_999).optional(),
  source: z.enum(LEAD_SOURCE_VALUES).default("OTHER"),
  temperature: z.enum(LEAD_TEMPERATURE_VALUES).default("COLD"),
  assignedToId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine((value) => value === undefined || /^[0-9a-f-]{36}$/i.test(value), {
      message: "Select a valid agent.",
    }),
  notes: z.string().trim().max(4000).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

