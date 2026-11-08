# The Purrse database, in plain English

Purrse keeps everyone's data in **Supabase**, an online database built on PostgreSQL.
This page explains what is stored, where, and who is allowed to see it.

## The big picture

- **Every person has an account.** They sign up with an email and a password.
  Supabase keeps the accounts themselves (emails and scrambled passwords) in its own
  safe area. Purrse never sees or stores passwords.
- **Every row belongs to one person.** Almost every table has a `user_id` column that
  says whose row it is.
- **People only ever see their own data.** The database itself checks this on every
  read and write (Supabase calls this *Row Level Security*). Even if someone tried to
  ask for another person's data on purpose, the database would answer with nothing.
- **Money is stored in fils, as whole numbers.** 1 KWD = 1000 fils, so 4.500 KWD is
  saved as `4500`. Whole numbers avoid rounding mistakes. The app turns them back into
  KWD with three decimals when it shows them.

## The tables

Think of each table as a spreadsheet. Here is what each one holds.

### `profile`: one row per person

Who the person is and the shape of their month.

| Column | What it means |
| --- | --- |
| `user_id` | Whose profile this is. |
| `name` | What Papi calls them, for example "Nourah". |
| `total_fils` | Their monthly budget, in fils (500 KWD = `500000`). Empty until setup is done. |
| `payday` | The day of the month their budget month starts (1 to 31). |
| `updated_at` | When this was last changed. |

### `categories`: the person's spending categories

Food, Transport, Bills, or anything they typed themselves, like "Gym".

| Column | What it means |
| --- | --- |
| `user_id` | Whose category this is. |
| `id` | A short name the app uses for it, like `food`, or a random code for typed ones. |
| `name` | The name people see. They can rename it. |
| `color` | The category's colour. |
| `icon` | The little drawing shown on its tile. |
| `limit_fils` | How much they plan to spend in it each month, in fils. |
| `position` | Its order on screen (0 comes first). |

### `spendings`: every spending they log

| Column | What it means |
| --- | --- |
| `user_id` | Whose spending this is. |
| `id` | A random code that identifies it. |
| `name` | What it was, for example "Coffee". |
| `category` | Which of their categories it belongs to (the category's `id`). |
| `fils` | How much it cost, in fils. Always more than zero. |
| `spent_on` | The day it was spent. |
| `created_at` | When it was added to Purrse. |
| `photo_path` | Where its optional photo is kept (see "Photos" below), or empty. |

### `papi_memory`: things Papi remembers

Short notes like "Payday is the 25th", shown on the Papi page under "What Papi remembers".
People can make Papi forget any of them.

| Column | What it means |
| --- | --- |
| `user_id` | Whose note this is. |
| `id` | A code for the note. |
| `text` | The note itself. |
| `position` | Its order in the list. |

### `chat_messages`: the conversation with Papi

| Column | What it means |
| --- | --- |
| `user_id` | Whose chat this is. |
| `position` | The message's place in the conversation (0, 1, 2…). |
| `who` | Who said it: `papi` or `you`. |
| `text` | The message. |
| `created_at` | When it was said. |

### `answered_questions`: questions Papi has already asked

Papi sometimes asks things like "Three deliveries since Friday. Busy few days?". This
table makes sure he doesn't ask the same thing twice.

| Column | What it means |
| --- | --- |
| `user_id` | Who answered. |
| `question_id` | Which question it was. |
| `answered_at` | When they answered. |

### `payments`: Purrse Pro checkouts

One row each time someone presses **Pay** for Purrse Pro.

| Column | What it means |
| --- | --- |
| `invoice_id` | MyFatoorah's number for the invoice. |
| `user_id` | Who is paying. |
| `amount_fils` | The price, in fils (1.500 KWD = `1500`). |
| `days` | How many days of Pro it buys (30). |
| `status` | `pending` until the payment is confirmed, then `paid`. |
| `payment_id` | MyFatoorah's number for the payment itself, once paid. |
| `created_at` | When they pressed Pay. |
| `paid_at` | When the payment was confirmed. |

### `pro_access`: who has Purrse Pro, and until when

| Column | What it means |
| --- | --- |
| `user_id` | Who has Pro. |
| `pro_until` | The moment Pro ends. If this date has passed, they are no longer Pro. |
| `updated_at` | When it last changed. |

## How the tables connect

```
account (kept by Supabase)
 ├── profile             (one per person)
 ├── categories          (many)
 │     └── spendings     (many; each one points at a category)
 ├── papi_memory         (many)
 ├── chat_messages       (many)
 ├── answered_questions  (many)
 ├── payments            (many)
 └── pro_access          (one, once they buy Pro)
```

- Each spending must point at one of the **same person's** categories. The database
  won't accept a spending in a category that doesn't exist.
- **A category can't be deleted while spendings still use it.** That's why the app asks
  where to move those spendings before deleting a category.
- If a category's `id` ever changes, its spendings follow it automatically.

## Who can see and change what

| Table | The person themselves | Everyone else |
| --- | --- | --- |
| `profile`, `categories`, `spendings`, `papi_memory`, `chat_messages`, `answered_questions` | Read and change their own rows | Nothing |
| `payments`, `pro_access` | **Read only** | Nothing |

`payments` and `pro_access` are read-only on purpose: otherwise anyone could make
themselves Pro from their browser. Only the two payment functions (below) can write to
them, and only after MyFatoorah confirms the money arrived.

## Photos

Spending photos are kept in Supabase **Storage**, in a private folder (a "bucket")
called `spending-photos`.

- Each person has their own sub-folder, named after their `user_id`.
- People can only upload, see and delete photos in their own folder.
- Photos are private. The app shows them through short-lived links that stop working
  after an hour.
- The `photo_path` column in `spendings` says which file belongs to which spending.

## How Purrse Pro payments flow

Two small server programs (Supabase *Edge Functions*) handle payments. They live in
`supabase/functions/` in this repo.

1. The person presses **Pay 1.500 KWD**.
2. **`create-payment`** asks MyFatoorah for an invoice, saves a `pending` row in
   `payments`, and sends back MyFatoorah's payment link. The link opens in a new tab.
3. The person pays on MyFatoorah's page (KNET, card, Apple Pay…).
4. MyFatoorah sends them back to Purrse's `/pro` page with a payment number in the address.
5. **`verify-payment`** asks MyFatoorah directly: "Was this really paid?" Only if the
   answer is yes does it mark the row `paid` and add 30 days to `pro_access`.
6. Each invoice can only count once. Opening the same link again doesn't add more days.

The MyFatoorah key is kept as a secret in Supabase (Edge Functions → Secrets), never in
this repo:

| Secret | What it is |
| --- | --- |
| `MYFATOORAH_API_KEY` | The API key from the MyFatoorah portal. |
| `MYFATOORAH_BASE_URL` | Optional. Leave it out for MyFatoorah's test server; set it to `https://api.myfatoorah.com` for real Kuwaiti payments. |
| `APP_URL` | Optional. Where people return after paying. Defaults to `https://purrse-swart.vercel.app`. |

## What happens when…

- **Someone signs out:** nothing is deleted. Their data is waiting when they sign back in.
- **Someone presses "Erase my data and start over":** their profile, categories,
  spendings, photos, Papi's notes and chat are deleted. Their account, payments and Pro
  stay.
- **An account is deleted** (from the Supabase dashboard): everything that belongs to it
  is deleted with it, in every table, automatically.
- **Someone uses Purrse without Supabase set up** (for example on a laptop with no keys):
  there's no sign-in, and everything is saved in that browser only.
