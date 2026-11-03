"use client";

import { useState, type FormEvent } from "react";
import { useApp } from "./AppProvider";
import { PapiBust } from "./ui";

export function NameEntry({ initial = "", onDone }: { initial?: string; onDone?: () => void }) {
  const { setName } = useApp();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = value.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Papi needs something to call you.");
      return;
    }
    setName(name.slice(0, 40));
    onDone?.();
  };

  return (
    <main className="welcome">
      <form className="welcome-card" onSubmit={submit} noValidate>
        <PapiBust mood="curious" size={150} bg="var(--mint)" alt="Papi, a black and white cat, looking up curiously" />
        <h1 className="welcome-title">What should Papi call you?</h1>
        <p className="welcome-sub">No password. Your name and spending stay on this device.</p>
        <label htmlFor="name" className="field-label">
          Your name
        </label>
        <input
          id="name"
          className="input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          autoComplete="given-name"
          maxLength={40}
          aria-invalid={!!error}
          aria-describedby={error ? "name-error" : undefined}
          autoFocus
        />
        {error && (
          <p id="name-error" className="field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn-solid btn-wide">
          Continue
        </button>
      </form>
    </main>
  );
}
