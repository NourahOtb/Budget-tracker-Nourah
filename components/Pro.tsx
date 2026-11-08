"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPayment, fetchProUntil, PRO_DAYS, PRO_PRICE_KWD, verifyPayment } from "@/lib/pro";
import { PapiBust } from "./ui";

type ProCtx = {
  /** False when the app runs without Supabase, so there is nothing to buy. */
  available: boolean;
  proUntil: Date | null;
  isPro: boolean;
  refresh(): Promise<void>;
  /** Lets the Pro page show a fresh date straight after verifying. */
  setProUntil(d: Date): void;
};

const OFF: ProCtx = { available: false, proUntil: null, isPro: false, refresh: async () => {}, setProUntil: () => {} };
const Ctx = createContext<ProCtx>(OFF);

export function usePro(): ProCtx {
  return useContext(Ctx);
}

/** Keeps the signed-in person's Pro status, rechecking when they come back to the tab. */
export function ProProvider({ children }: { children: ReactNode }) {
  const [proUntil, setProUntil] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setProUntil(await fetchProUntil());
    } catch (err) {
      console.error("Purrse: checking Pro failed", err);
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    let alive = true;
    fetchProUntil().then(
      (d) => alive && setProUntil(d),
      (err) => console.error("Purrse: checking Pro failed", err),
    );
    // Payment happens in another tab, so look again when this one is back in view.
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const value: ProCtx = {
    available: true,
    proUntil,
    isPro: !!proUntil && proUntil.getTime() > now,
    refresh,
    setProUntil: (d) => {
      setProUntil(d);
      setNow(Date.now());
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const FEATURES = [
  { title: "Papi becomes your financial advisor", text: "Talk to him in the chat you already use. He answers like an advisor, not a script." },
  { title: "Advice from your real numbers", text: "He reads your budgets, categories and spending before he answers, so the advice fits your month." },
  { title: "Ask anything", text: "“Can I afford a 300 KWD trip in March?” “Where can I save 50 KWD?” “Help me plan for Eid.”" },
  { title: "Plans, not just answers", text: "Set a goal and Papi helps you get there, checking in as your month goes." },
];

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "paid"; until: Date }
  | { state: "unpaid"; text: string }
  | { state: "error"; text: string };

export function ProScreen() {
  const pro = usePro();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  // MyFatoorah sends people back to /pro?paymentId=… once they finish paying.
  // This screen only renders in the browser (after the budget loads), so window is there.
  const [paymentId] = useState(() => new URLSearchParams(window.location.search).get("paymentId"));
  const [check, setCheck] = useState<Check>(paymentId && pro.available ? { state: "checking" } : { state: "idle" });
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !pro.available || !paymentId) return;
    checked.current = true;
    window.history.replaceState(null, "", "/pro");
    verifyPayment(paymentId).then(
      (r) => {
        if (r.status === "paid") {
          pro.setProUntil(r.proUntil);
          setCheck({ state: "paid", until: r.proUntil });
        } else {
          const why = r.reason ? ` MyFatoorah said: “${r.reason}”.` : "";
          setCheck({
            state: "unpaid",
            text:
              r.status === "pending"
                ? "The payment is still processing. Give it a minute, then refresh this page."
                : `The payment didn’t go through, so nothing was charged.${why} You can try again below.`,
          });
        }
      },
      (err: Error) => setCheck({ state: "error", text: err.message }),
    );
  }, [pro, paymentId]);

  const pay = async () => {
    if (busy) return;
    setError("");
    setFallbackUrl(null);
    // Open the tab during the click, or browsers treat it as a pop-up and block it.
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.title = "Opening MyFatoorah…";
      tab.document.body.style.cssText = "font-family:system-ui,sans-serif;background:#1c1822;color:#f7f1e8;display:grid;place-items:center;height:100vh;margin:0";
      tab.document.body.textContent = "Papi is opening the payment page…";
    }
    setBusy(true);
    try {
      const url = await createPayment();
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        setFallbackUrl(url);
      }
    } catch (err) {
      tab?.close();
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page pro-page">
      <section className="panel pro-hero" aria-labelledby="pro-title">
        <PapiBust mood="playful" size={110} bg="var(--amber)" />
        <div>
          <p className="pro-kicker">Purrse Pro</p>
          <h1 id="pro-title" className="h1">
            Papi, your own financial advisor
          </h1>
          <p className="muted pro-lede">Everything in Purrse, plus a Papi who thinks with you about money.</p>
        </div>
      </section>

      <div role="status" aria-live="polite">
        {check.state === "checking" && <p className="pro-note">Papi is checking your payment with MyFatoorah…</p>}
        {check.state === "paid" && (
          <div className="pro-note good">
            <p className="pro-note-title">Welcome to Purrse Pro!</p>
            <p>
              Your payment went through. Pro is on until {longDate(check.until)}.{" "}
              <Link href="/papi" className="text-link">
                Go talk to Papi
              </Link>
            </p>
          </div>
        )}
        {(check.state === "unpaid" || check.state === "error") && <p className="pro-note warn">{check.text}</p>}
      </div>

      <div className="pro-grid">
        <section aria-labelledby="pro-features" className="panel">
          <h2 id="pro-features" className="h2">
            What you get
          </h2>
          <ul className="pro-list">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="pro-tick" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <p className="pro-feature">{f.title}</p>
                  <p className="muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pro-price" className="panel pro-buy">
          <h2 id="pro-price" className="sr-only">
            Price
          </h2>
          <p className="pro-amount">
            <span className="num">{PRO_PRICE_KWD}</span> KWD
          </p>
          <p className="muted">for {PRO_DAYS} days. Pay once, no automatic renewal.</p>

          {pro.isPro && pro.proUntil && <p className="pro-status">You’re Pro until {longDate(pro.proUntil)}.</p>}

          {pro.available ? (
            <>
              <button type="button" className="btn-solid btn-wide" onClick={pay} disabled={busy} aria-describedby="pro-pay-hint">
                {busy ? "Opening the payment page…" : pro.isPro ? `Add ${PRO_DAYS} more days` : `Pay ${PRO_PRICE_KWD} KWD`}
              </button>
              <p id="pro-pay-hint" className="field-hint pro-hint">
                Opens MyFatoorah’s secure page in a new tab. Pay with KNET, a card or Apple Pay, then come back here.
              </p>
            </>
          ) : (
            <p className="field-hint">Purrse Pro needs an account. It isn’t available in this offline copy.</p>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {fallbackUrl && (
            <p className="pro-hint">
              Your browser blocked the new tab.{" "}
              <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="text-link">
                Open the payment page
              </a>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
