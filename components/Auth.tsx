"use client";

import type { AuthError, Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { localStore, storeFor, supabase } from "@/lib/store";
import { AppProvider } from "./AppProvider";
import { ProProvider } from "./Pro";
import { PapiBust } from "./ui";

type AuthCtx = { email: string; signOut(): Promise<void> };
const Ctx = createContext<AuthCtx | null>(null);

/** The signed-in account, or null when the app runs without Supabase. */
export function useAuth(): AuthCtx | null {
  return useContext(Ctx);
}

const MIN_PASSWORD = 8;

/** Turns Supabase's error codes into something Papi would say. */
function friendly(error: AuthError | Error): string {
  const code = "code" in error ? error.code : undefined;
  switch (code) {
    case "invalid_credentials":
      return "That email and password don’t match. Check for typos, or tap “Forgot password?” to choose a new one.";
    case "email_not_confirmed":
      return "Your email isn’t confirmed yet. Tap the link Papi sent you, then sign in.";
    case "user_already_exists":
    case "email_exists":
      return "There’s already an account with this email. Sign in instead.";
    case "weak_password":
      return `Choose a stronger password: at least ${MIN_PASSWORD} characters, mixing letters and numbers.`;
    case "same_password":
      return "That’s your current password. Choose a new one.";
    case "email_address_invalid":
    case "validation_failed":
      return "That email doesn’t look right. Check it and try again.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many tries in a short time. Wait a few minutes, then try again.";
    case "signup_disabled":
      return "New accounts are switched off right now.";
  }
  if (error.name === "AuthRetryableFetchError" || /fetch|network/i.test(error.message)) {
    return "Papi can’t reach the internet. Check your connection and try again.";
  }
  return "Something went wrong. Try again in a moment.";
}

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * Shows the sign-in screens until someone is signed in, then the app with
 * their own data. Without Supabase there are no accounts: data stays in this browser.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!supabase) return <AppProvider store={localStore}>{children}</AppProvider>;
  return <SignedIn>{children}</SignedIn>;
}

function SignedIn({ children }: { children: ReactNode }) {
  // undefined while checking for a saved session.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovering, setRecovering] = useState(false);
  const userId = session?.user.id ?? null;
  const store = useMemo(() => storeFor(userId), [userId]);

  useEffect(() => {
    const auth = supabase!.auth;
    void auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((event, next) => {
      // Only set state here: calling Supabase inside this callback can deadlock.
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const ctx = useMemo<AuthCtx | null>(
    () =>
      session
        ? {
            email: session.user.email ?? "",
            signOut: async () => {
              await supabase!.auth.signOut();
            },
          }
        : null,
    [session],
  );

  if (session === undefined) return <div className="splash" aria-busy="true" />;
  if (session && recovering) return <NewPassword onDone={() => setRecovering(false)} />;
  if (!session || !ctx) return <AuthScreen />;

  return (
    <Ctx.Provider value={ctx}>
      <ProProvider key={session.user.id}>
        <AppProvider store={store}>{children}</AppProvider>
      </ProProvider>
    </Ctx.Provider>
  );
}

type Mode = "signin" | "signup" | "forgot";

const COPY: Record<Mode, { title: string; sub: string; button: string }> = {
  signin: { title: "Welcome back", sub: "Sign in and Papi will fetch your budget.", button: "Sign in" },
  signup: { title: "Make an account", sub: "So your budget follows you to any device.", button: "Create account" },
  forgot: { title: "Forgot your password?", sub: "Papi will email you a link to choose a new one.", button: "Send reset link" },
};

function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  const go = (m: Mode) => {
    setMode(m);
    setError("");
    setNotice("");
    setPassword("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const mail = email.trim();
    setNotice("");
    if (!looksLikeEmail(mail)) return setError("Type your email, like you@example.com.");
    if (mode !== "forgot" && !password) return setError("Type your password.");
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    }
    setError("");
    setBusy(true);
    const auth = supabase!.auth;
    try {
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email: mail, password });
        if (error) setError(friendly(error));
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({ email: mail, password });
        if (error) setError(friendly(error));
        else if (!data.session) {
          setMode("signin");
          setPassword("");
          setNotice(`Almost there. Papi sent a link to ${mail}. Tap it to confirm your email, then sign in.`);
        }
      } else {
        const { error } = await auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin });
        if (error) setError(friendly(error));
        else setNotice(`If there’s an account for ${mail}, a reset link is on its way. Check your inbox and spam folder.`);
      }
    } catch (err) {
      setError(friendly(err as Error));
    } finally {
      setBusy(false);
    }
  };

  const describedBy = error ? "auth-error" : notice ? "auth-notice" : undefined;

  return (
    <main className="welcome">
      <form className="welcome-card auth-card" onSubmit={submit} noValidate aria-busy={busy}>
        <PapiBust
          mood={error ? "worried" : mode === "signup" ? "playful" : "curious"}
          size={130}
          bg={error ? "var(--coral)" : "var(--mint)"}
          alt=""
        />
        <h1 className="welcome-title">{copy.title}</h1>
        <p className="welcome-sub">{copy.sub}</p>

        <label htmlFor="auth-email" className="field-label">
          Email
        </label>
        <input
          id="auth-email"
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          aria-invalid={!!error && !looksLikeEmail(email.trim())}
          aria-describedby={describedBy}
          autoFocus
        />

        {mode !== "forgot" && (
          <>
            <div className="auth-label-row">
              <label htmlFor="auth-password" className="field-label">
                Password
              </label>
              {mode === "signin" && (
                <button type="button" className="link-btn auth-forgot" onClick={() => go("forgot")}>
                  Forgot password?
                </button>
              )}
            </div>
            <div className="password-row">
              <input
                id="auth-password"
                className="input"
                type={show ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                aria-invalid={!!error && mode === "signin"}
                aria-describedby={mode === "signup" ? "auth-pw-hint" : describedBy}
              />
              <button type="button" className="btn-ghost" onClick={() => setShow((v) => !v)} aria-pressed={show}>
                {show ? "Hide" : "Show"}
                <span className="sr-only"> password</span>
              </button>
            </div>
            {mode === "signup" && (
              <p id="auth-pw-hint" className="field-hint">
                At least {MIN_PASSWORD} characters.
              </p>
            )}
          </>
        )}

        <div role="alert" aria-live="assertive">
          {error && (
            <p id="auth-error" className="field-error">
              {error}
            </p>
          )}
        </div>
        <div role="status">
          {notice && (
            <p id="auth-notice" className="auth-notice">
              {notice}
            </p>
          )}
        </div>

        <button type="submit" className="btn-solid btn-wide" disabled={busy}>
          {busy ? "One moment…" : copy.button}
        </button>

        <p className="auth-switch">
          {mode === "signin" ? (
            <>
              New to Purrse?{" "}
              <button type="button" className="link-btn" onClick={() => go("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              {mode === "signup" ? "Already have an account?" : "Remembered it?"}{" "}
              <button type="button" className="link-btn" onClick={() => go("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </main>
  );
}

/** Shown after following a reset link from the email. */
function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) return setError(`Your new password needs at least ${MIN_PASSWORD} characters.`);
    if (password !== again) return setError("The two passwords don’t match. Type them again.");
    setError("");
    setBusy(true);
    try {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) setError(friendly(error));
      else onDone();
    } catch (err) {
      setError(friendly(err as Error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="welcome">
      <form className="welcome-card auth-card" onSubmit={submit} noValidate>
        <PapiBust mood="playful" size={130} bg="var(--mint)" alt="" />
        <h1 className="welcome-title">Choose a new password</h1>
        <p className="welcome-sub">Then Papi takes you straight to your budget.</p>
        <label htmlFor="new-pw" className="field-label">
          New password
        </label>
        <input
          id="new-pw"
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          aria-describedby="new-pw-hint"
          autoFocus
        />
        <p id="new-pw-hint" className="field-hint">
          At least {MIN_PASSWORD} characters.
        </p>
        <label htmlFor="new-pw-2" className="field-label">
          Type it again
        </label>
        <input
          id="new-pw-2"
          className="input"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => {
            setAgain(e.target.value);
            setError("");
          }}
        />
        <div role="alert">{error && <p className="field-error">{error}</p>}</div>
        <button type="submit" className="btn-solid btn-wide" disabled={busy}>
          {busy ? "One moment…" : "Save new password"}
        </button>
      </form>
    </main>
  );
}
