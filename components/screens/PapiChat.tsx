"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHAT_PROMPTS } from "@/lib/papi";
import { useReady } from "../AppProvider";
import { PapiBust } from "../ui";

export function PapiScreen() {
  const { name, mood, data, question, papiTyping, ask, answerQuestion, forgetMemory } = useReady();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const chat = [
    ...(data.chat.length ? [] : [{ who: "papi" as const, text: `Hi ${name}. Ask me anything about your spending.` }]),
    ...data.chat,
    ...(question ? [{ who: "papi" as const, text: question.text }] : []),
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [data.chat.length, papiTyping]);

  const send = (q: string) => {
    if (!q.trim() || papiTyping) return;
    void ask(q);
    setText("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  return (
    <div className="papi-grid">
      <section aria-label="Conversation with Papi" className="chat">
        <div className="chat-head">
          <PapiBust mood={mood} />
          <div>
            <h1 className="h1">Papi</h1>
            <p className="muted">Quiet. Curious. Reads every receipt.</p>
          </div>
        </div>
        <div className="bubbles" aria-live="polite">
          {chat.map((m, i) => (
            <div key={i} className={m.who === "papi" ? "bubble papi" : "bubble you"}>
              <span className="sr-only">{m.who === "papi" ? "Papi: " : "You: "}</span>
              {m.text}
            </div>
          ))}
          {papiTyping && <div className="bubble papi typing">Papi is thinking…</div>}
          <div ref={endRef} />
        </div>
        <div className="chips">
          {question?.answers.map((a, i) => (
            <button key={a.label} type="button" className="chip" onClick={() => answerQuestion(question, i)}>
              {a.label}
            </button>
          ))}
          {CHAT_PROMPTS.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => send(p)}>
              {p}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="ask-row">
          <label htmlFor="ask" className="sr-only">
            Ask Papi
          </label>
          <input id="ask" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Can I afford 25 KWD shoes?" autoComplete="off" />
          <button type="submit" className="btn-solid" disabled={papiTyping}>
            Ask
          </button>
        </form>
      </section>

      <aside aria-labelledby="mem-title" className="panel memory">
        <h2 id="mem-title" className="h2">
          What Papi remembers
        </h2>
        <p className="muted mem-intro">He uses these so he doesn’t ask you twice. You can make him forget anything.</p>
        {data.memory.length ? (
          <ul className="mem-list">
            {data.memory.map((m) => (
              <li key={m.id}>
                <p>{m.text}</p>
                <button type="button" className="forget" onClick={() => forgetMemory(m.id)} aria-label={`Forget: ${m.text}`}>
                  Forget
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nothing yet. Answer one of his questions and it will show up here.</p>
        )}
      </aside>
    </div>
  );
}
