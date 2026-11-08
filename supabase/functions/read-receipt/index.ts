// Reads a receipt photo with a free AI model on OpenRouter and returns what
// Papi should fill in: the total paid, a short name, a category guess and the
// date. The app shows these so the person can check them before adding.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   OPENROUTER_API_KEY        required
//   OPENROUTER_RECEIPT_MODELS optional, comma-separated vision model ids to try in order
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DAILY_LIMIT = 20;
const MAX_IMAGE_CHARS = 4_000_000; // about 3 MB of photo once encoded
const API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODELS = (Deno.env.get("OPENROUTER_RECEIPT_MODELS") ??
  "google/gemma-4-31b-it:free,nvidia/nemotron-3.5-super-vl:free,google/gemma-4-26b-a4b-it:free")
  .split(",").map((s) => s.trim()).filter(Boolean);
const APP_URL = Deno.env.get("APP_URL") ?? "https://purrse-swart.vercel.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Category = { id: string; name: string };

function prompt(categories: Category[], today: string) {
  return `Read this photo of a receipt or bill. Today's date is ${today}.
Reply with ONE JSON object and nothing else, using exactly these keys:
{
  "is_receipt": true or false (false if the photo is not a receipt, bill or invoice, or is unreadable),
  "total": the final amount the customer paid, as a number (after discounts, tax and service; ignore change given back). null if you can't read it,
  "currency": the 3-letter currency code shown, like "KWD", or null if none is shown,
  "merchant": the shop or company name as printed (in English letters if it's shown in both), or null,
  "item": what was bought in 1 to 4 words, like "Groceries" or "Coffee", or null,
  "date": the purchase date as "YYYY-MM-DD", or null,
  "category_id": the best matching id from this list, or null: ${JSON.stringify(categories)}
}
Kuwaiti receipts usually use KWD or "KD" with three decimals, like 4.750. Read numbers carefully; don't guess.`;
}

/** Pulls the first {...} object out of a model reply, even if it wrapped it in text or code fences. */
function parseObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

const tidy = (s: unknown, max = 40) =>
  typeof s === "string" && s.trim() ? s.trim().replace(/\s+/g, " ").slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!API_KEY) return json({ error: "not_configured", message: "Receipt reading isn’t switched on yet. Type the amount for now." }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "signed_out", message: "Sign in again, then try once more." }, 401);

  const body = await req.json().catch(() => null);
  const image = typeof body?.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_IMAGE_CHARS) {
    return json({ error: "bad_image", message: "Papi couldn’t open that photo. Try another one." }, 400);
  }
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const categories: Category[] = Array.isArray(body?.categories)
    ? body.categories
        .filter((c: Category) => typeof c?.id === "string" && typeof c?.name === "string")
        .slice(0, 40)
        .map((c: Category) => ({ id: c.id.slice(0, 60), name: c.name.slice(0, 30) }))
    : [];

  const { data: left, error: limitError } = await admin.rpc("use_ai", { p_user: user.id, p_kind: "receipt", p_limit: DAILY_LIMIT });
  if (limitError) {
    console.error("use_ai failed", limitError);
    return json({ error: "server_error", message: "Papi couldn’t read it. Type the amount instead." }, 500);
  }
  if (left < 0) {
    return json({ error: "daily_limit", message: `Papi has read ${DAILY_LIMIT} receipts today, his daily limit. Type this one, and he’ll read again tomorrow.` }, 429);
  }

  let out: Record<string, unknown> | null = null;
  let status = 0;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": APP_URL,
        "X-Title": "Purrse",
      },
      body: JSON.stringify({
        models: MODELS,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt(categories, today) },
            { type: "image_url", image_url: { url: image } },
          ],
        }],
        max_tokens: 400,
        temperature: 0,
        reasoning: { enabled: false },
      }),
    });
    status = res.status;
    const reply = await res.json().catch(() => null);
    const content = reply?.choices?.[0]?.message?.content;
    out = typeof content === "string" ? parseObject(content) : null;
    if (!res.ok || !out) console.error("OpenRouter receipt failed", res.status, JSON.stringify(reply)?.slice(0, 800));
  } catch (err) {
    console.error("OpenRouter unreachable", err);
  }

  if (!out) {
    await admin.rpc("refund_ai", { p_user: user.id, p_kind: "receipt" });
    const busy = status === 429 || status === 503;
    return json({
      error: "ai_error",
      message: busy ? "Papi’s receipt reader is busy right now. Try again in a minute, or type the amount." : "Papi couldn’t read that receipt. Type the amount instead.",
    }, 502);
  }

  if (out.is_receipt === false) {
    return json({ found: false, message: "That doesn’t look like a receipt to Papi. Type the amount, or try a clearer photo.", left });
  }

  const total = typeof out.total === "number" ? out.total : Number(out.total);
  const currency = tidy(out.currency, 3)?.toUpperCase().replace("KD", "KWD") ?? null;
  const isKwd = !currency || currency === "KWD" || currency === "KD";
  const fils = Number.isFinite(total) && total > 0 && total < 100_000 && isKwd ? Math.round(total * 1000) : null;
  const date = typeof out.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(out.date) && out.date <= today && !Number.isNaN(Date.parse(out.date))
    ? out.date
    : null;
  const cat = categories.some((c) => c.id === out!.category_id) ? (out.category_id as string) : null;
  const name = tidy(out.merchant) ?? tidy(out.item) ?? null;

  let message: string | null = null;
  if (!fils && Number.isFinite(total) && total > 0 && !isKwd) {
    message = `This receipt is in ${currency}. Type the amount in KWD and Papi will fill in the rest.`;
  } else if (!fils) {
    message = "Papi couldn’t find the total. Type the amount, and he’ll fill in the rest.";
  }

  return json({ found: true, fils, name, cat, date, currency, message, left });
});
