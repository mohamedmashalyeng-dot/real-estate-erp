"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FormField, Input, Select, Textarea } from "@/components/ui/form-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays";
import { formatMoney } from "@/lib/format";
import { recordPaymentAction } from "./actions";

function today(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function RecordPaymentDialog({
  installmentId,
  saleReference,
  sequence,
  remaining,
  currency,
  size = "sm",
}: {
  installmentId: string;
  saleReference: string;
  sequence: number;
  /** Unpaid balance as a decimal string, e.g. "12500.00". */
  remaining: string;
  currency: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function submit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await recordPaymentAction({
        installmentId,
        amount: String(formData.get("amount") ?? ""),
        paidAt: String(formData.get("paidAt") ?? ""),
        method: String(formData.get("method") ?? "CASH") as "CASH",
        reference: String(formData.get("reference") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline">
          <Banknote /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,30rem)]">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {saleReference} · installment #{sequence} · remaining {formatMoney(remaining, currency, { maximumFractionDigits: 2 })}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-3">
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="payment-amount" required error={fieldErrors.amount}>
              <Input
                id="payment-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={remaining}
                defaultValue={remaining}
                required
              />
            </FormField>
            <FormField label="Paid on" htmlFor="payment-date" required error={fieldErrors.paidAt}>
              <Input id="payment-date" name="paidAt" type="date" defaultValue={today()} max={today()} required />
            </FormField>
            <FormField label="Method" htmlFor="payment-method" error={fieldErrors.method}>
              <Select id="payment-method" name="method" defaultValue="BANK_TRANSFER">
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </Select>
            </FormField>
            <FormField label="Reference" htmlFor="payment-reference" hint="Cheque / transfer no." error={fieldErrors.reference}>
              <Input id="payment-reference" name="reference" maxLength={120} />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="payment-notes" error={fieldErrors.notes}>
            <Textarea id="payment-notes" name="notes" rows={2} maxLength={2000} className="resize-none" />
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
