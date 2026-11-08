// Called when MyFatoorah sends someone back to /pro?paymentId=…
// Asks MyFatoorah whether that payment really went through and, if so,
// adds 30 days of Pro. Never trusts the browser's word for it.
//
// Uses the same secrets as create-payment: MYFATOORAH_API_KEY, MYFATOORAH_BASE_URL.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE_URL = (Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("MYFATOORAH_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Transaction = { TransactionStatus?: string; Error?: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!API_KEY) return json({ error: "not_configured", message: "Payments aren’t set up yet." }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "signed_out", message: "Sign in again to finish." }, 401);

  const { paymentId } = await req.json().catch(() => ({}));
  if (typeof paymentId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(paymentId)) {
    return json({ error: "bad_request", message: "That payment link looks incomplete." }, 400);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/v2/GetPaymentStatus`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Key: paymentId, KeyType: "PaymentId" }),
    });
  } catch (err) {
    console.error("MyFatoorah unreachable", err);
    return json({ error: "gateway_unreachable", message: "Papi couldn’t check the payment. Try again in a moment." }, 502);
  }

  const body = await res.json().catch(() => null);
  const data = body?.Data;
  if (!res.ok || !body?.IsSuccess || !data?.InvoiceId) {
    console.error("MyFatoorah GetPaymentStatus failed", res.status, JSON.stringify(body));
    return json({ error: "gateway_error", message: "Papi couldn’t check the payment. Try again in a moment." }, 502);
  }

  // The invoice must be one create-payment made for this same person.
  const { data: payment } = await admin
    .from("payments")
    .select("invoice_id")
    .eq("invoice_id", data.InvoiceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!payment) return json({ error: "not_found", message: "Papi can’t find this payment on your account." }, 404);

  if (data.InvoiceStatus !== "Paid") {
    const tx = (data.InvoiceTransactions as Transaction[] | undefined) ?? [];
    const reason = tx.at(-1)?.Error || null;
    return json({ status: String(data.InvoiceStatus ?? "Pending").toLowerCase(), reason });
  }

  const { data: proUntil, error } = await admin.rpc("grant_pro", { p_invoice_id: data.InvoiceId, p_payment_id: paymentId });
  if (error) {
    console.error("grant_pro failed", error);
    return json({ error: "save_failed", message: "You paid, but Papi couldn’t switch Pro on. Refresh to try again." }, 500);
  }
  return json({ status: "paid", proUntil });
});
