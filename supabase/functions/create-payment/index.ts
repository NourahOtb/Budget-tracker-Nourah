// Creates a MyFatoorah invoice for 30 days of Purrse Pro and returns its
// payment link. The person picks how to pay (KNET, card, Apple Pay…) on
// MyFatoorah's page, which then sends them back to /pro?paymentId=…
//
// Secrets (Supabase → Edge Functions → Secrets):
//   MYFATOORAH_API_KEY   required, the API token from your MyFatoorah portal
//   MYFATOORAH_BASE_URL  optional, defaults to the test API; live Kuwait is https://api.myfatoorah.com
//   APP_URL              optional, where people return to; defaults to the Vercel site
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PRICE_KWD = 1.5;
const PRICE_FILS = 1500;
const DAYS = 30;

const BASE_URL = (Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("MYFATOORAH_API_KEY");
const APP_URL = (Deno.env.get("APP_URL") ?? "https://purrse-swart.vercel.app").replace(/\/+$/, "");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!API_KEY) return json({ error: "not_configured", message: "Payments aren’t set up yet. Try again soon." }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "signed_out", message: "Sign in again, then try once more." }, 401);

  const { data: profile } = await admin.from("profile").select("name").eq("user_id", user.id).maybeSingle();
  const name = (profile?.name as string | undefined)?.trim() || user.email?.split("@")[0] || "Purrse friend";
  const back = `${APP_URL}/pro`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/v2/SendPayment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        InvoiceValue: PRICE_KWD,
        CustomerName: name.slice(0, 100),
        CustomerEmail: user.email ?? undefined,
        NotificationOption: "LNK",
        DisplayCurrencyIso: "KWD",
        Language: "en",
        CallBackUrl: back,
        ErrorUrl: back,
        CustomerReference: user.id,
        UserDefinedField: user.id,
        InvoiceItems: [{ ItemName: `Purrse Pro (${DAYS} days)`, Quantity: 1, UnitPrice: PRICE_KWD }],
      }),
    });
  } catch (err) {
    console.error("MyFatoorah unreachable", err);
    return json({ error: "gateway_unreachable", message: "Papi couldn’t reach the payment page. Try again in a moment." }, 502);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.IsSuccess || !body?.Data?.InvoiceURL) {
    console.error("MyFatoorah SendPayment failed", res.status, JSON.stringify(body));
    return json({ error: "gateway_error", message: "The payment page couldn’t be created. Try again in a moment." }, 502);
  }

  const { error } = await admin.from("payments").insert({
    invoice_id: body.Data.InvoiceId,
    user_id: user.id,
    amount_fils: PRICE_FILS,
    days: DAYS,
  });
  if (error) {
    console.error("Saving the payment failed", error);
    return json({ error: "save_failed", message: "Something went wrong. Try again in a moment." }, 500);
  }

  return json({ url: body.Data.InvoiceURL, invoiceId: body.Data.InvoiceId });
});
