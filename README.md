# Purrse

A dark, playful budget tracker. Papi the cat keeps count and notices things.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm test
```

runs the budget maths tests (status, category state, per-day amount, periods, fils formatting, quick add).

## Where things live

| Path | What it does |
|---|---|
| `lib/money.ts` | Amounts are whole fils (1 KWD = 1000 fils), always shown with three decimals |
| `lib/budget.ts` | Budget period from payday, status, category state, per-day amount, Papi's mood |
| `lib/summary.ts` | Everything a screen needs for the current period, plus usuals |
| `lib/store.ts` | The only place data is read or written. Uses Supabase when its keys are set, otherwise this browser's `localStorage` |
| `lib/supabaseStore.ts` | Reads all of Purrse's tables and saves only what changed |
| `lib/papi.ts` | Papi's rule-based lines and questions. `papiReply` is the one function to replace with a real AI agent |
| `components/screens/` | Today, Spending, Budgets, Insights and Papi |
| `design/` | The original design, screenshots and build brief |

## Data

Purrse has one user and no sign-in. Data lives in Supabase (tables `profile`, `category_limits`, `spendings`, `papi_memory`, `chat_messages`, `answered_questions`), so it is the same on every device. Because there is no sign-in, anyone who opens the site can see and change it.

Local setup needs a `.env.local` file (not committed):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Without it, the app falls back to saving in the browser.
