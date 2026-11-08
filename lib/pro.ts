// Purrse Pro: 30 days of Papi as a financial advisor, paid through MyFatoorah.
// The browser only ever reads Pro status; the edge functions create the
// payment link and switch Pro on after checking the payment with MyFatoorah.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./store";

export const PRO_PRICE_KWD = "1.500";
export const PRO_DAYS = 30;

/** When Pro ends for the signed-in person, or null if they've never had it. */
export async function fetchProUntil(): Promise<Date | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("pro_access").select("pro_until").maybeSingle();
  if (error) throw error;
  return data ? new Date(data.pro_until as string) : null;
}

/** Pulls the friendly message an edge function sent with its error. */
async function messageFrom(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body && typeof body.message === "string") return body.message;
  }
  return fallback;
}

/** Asks the create-payment edge function for a MyFatoorah payment link. */
export async function createPayment(): Promise<string> {
  if (!supabase) throw new Error("Sign in to buy Purrse Pro.");
  const { data, error } = await supabase.functions.invoke<{ url: string }>("create-payment", { body: {} });
  if (error || !data?.url) {
    throw new Error(await messageFrom(error, "Papi couldn’t open the payment page. Try again in a moment."));
  }
  return data.url;
}

export type VerifyResult =
  | { status: "paid"; proUntil: Date }
  | { status: "pending" | "canceled" | "failed"; reason: string | null };

/** Asks verify-payment whether the payment MyFatoorah sent back really went through. */
export async function verifyPayment(paymentId: string): Promise<VerifyResult> {
  if (!supabase) throw new Error("Sign in to finish.");
  const { data, error } = await supabase.functions.invoke<{ status: string; proUntil?: string; reason?: string | null }>("verify-payment", {
    body: { paymentId },
  });
  if (error || !data) throw new Error(await messageFrom(error, "Papi couldn’t check the payment. Refresh to try again."));
  if (data.status === "paid" && data.proUntil) return { status: "paid", proUntil: new Date(data.proUntil) };
  const status = data.status === "pending" || data.status === "canceled" ? data.status : "failed";
  return { status, reason: data.reason ?? null };
}
