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
| `lib/store.ts` | The only place data is read or written. Today it is `localStorage`; write another `DataStore` to move to Supabase |
| `lib/papi.ts` | Papi's rule-based lines and questions. `papiReply` is the one function to replace with a real AI agent |
| `components/screens/` | Today, Spending, Budgets, Insights and Papi |
| `design/` | The original design, screenshots and build brief |

## Data

Everything is saved in the browser on this device. Nothing is sent anywhere. There is no login: the person types a name and Papi remembers it here.
