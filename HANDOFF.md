# Purrse: build brief

Purrse is a dark, playful budget-tracking website. Papi, the owner's real black-and-white cat, is its mascot and will later become its AI advisor.

Build it in Next.js so it matches the design. The goal for now is a working app that runs locally. Deploying to Vercel comes later, so keep it ready for that.

## Confirmed requirements

- **No login or authentication for now.** The person types a simple name and enters.
- **It must go live on Vercel later.** Do not deploy until the owner asks.
- **Papi's AI agent comes later.** Build him as a mascot with rule-based messages now, in a way that real AI can replace.
- Check with the owner whether her Coded brief has any other required features or tools before making choices that would be hard to change.

## Decide with the owner before building

**Where should the data be saved?** The design does not settle this. Ask, and give this recommendation:

- **Recommended for now: save in the browser (localStorage).** It is simple and private because data stays on that device and needs no accounts. The downside is that data does not follow the person to another device or browser.
- **Alternative: Supabase.** Data follows the person, but with name-only entry anyone who types the same name could see that person's spending. It would need real authentication before holding real data.

Put all data reads and writes behind one small module, so switching to Supabase later does not touch the screens.

## What is in this folder

| Path | What it is |
|---|---|
| `design/screenshots/` | How each screen should look. Start here. These were rendered with a fallback font, so the type differs from the final fonts below |
| `design/source/Main.dc.html` | The whole prototype: markup, styles, all copy, and working logic. This is the source of truth for behaviour |
| `design/source/Papi.dc.html` | Papi's character sheet, with his moods and lines |
| `design/source/` other files | Thin wrappers that show `Main` at a given screen or budget state. They hold no extra design |
| `assets/papi/` | Papi's 10 SVG drawings. Move these to `public/papi/` |

The `.dc.html` files use a custom design-canvas format (`<x-dc>`, `<sc-if>`, `<sc-for>`, `{{holes}}`, `class Component extends DCLogic`). Do not try to run them. Read them and rebuild the screens as normal React components.

### Image references in the design source

| Reference in `Main.dc.html` | File |
|---|---|
| `/_blob/ee31c01e398a404e9c20aa97cab45e94` | `lounge-content.svg` |
| `/_blob/3e3a61d2d65a21d3d3e44cdcde677ff1` | `lounge-curious.svg` |
| `/_blob/6492d5badeb3303219808e78854fe3ae` | `lounge-needy.svg` |
| `/_blob/cfe3e5cd1e6c741d23218e9679c96217` | `lounge-playful.svg` |
| `/_blob/3f022947f2333e8e4487b0b69b044ec1` | `lounge-worried.svg` |
| `/_blob/85f42c148154e7d747da6b05d85d202a` | `papi-content.svg` |
| `/_blob/1dcbf01a5f9e0b4b8ccae84217ef7ab4` | `papi-curious.svg` |
| `/_blob/e10617c3c508bac9b1f42f6c59621c54` | `papi-needy.svg` |
| `/_blob/a013a81566994ee6cbbdd389b6e4f3b4` | `papi-playful.svg` |
| `/_blob/36c1db56a36ce947897d67b6c812d192` | `papi-worried.svg` |

In the `lounge` drawings, the card's bottom edge lines up with y=320 of the 450-tall viewBox, so the paws hang over it.

## Stack

- Next.js with the App Router and TypeScript
- Fonts through `next/font/google`: **Bricolage Grotesque** (500, 700, 800) for headings, numbers and Papi's words; **Figtree** (400 to 700) for everything else
- Styling is your choice, but keep the values below as named tokens

**Project setup catch:** the folder is named `Budget app.`, which is not a valid npm package name, so `create-next-app .` may refuse it. Use the package name `purrse`, for example by generating into a temporary subfolder and moving the files up. Do not rename the folder or disturb `.git`.

## Git

- Git is already set up here on branch `main`, with `origin` pointing to `https://github.com/NourahOtb/Budget-tracker-Nourah.git`. That repository is empty.
- Nothing has been committed or pushed. Commit or push only when the owner asks.
- Before the first push, check that this Mac's GitHub account can write to `NourahOtb`, and check `git config user.name` and `user.email`. The Mac's user is `reemalotaibi`, so it may be signed in to another account.
- An empty leftover file, `.git/tWd4efO`, is harmless. It is safe to delete.
- Make sure `.gitignore` covers `node_modules`, `.next` and `.env*`.

## Design tokens

**Surfaces and text**

| Token | Value | Use |
|---|---|---|
| ground | `#1C1822` | Page background, ink on coloured surfaces |
| surface | `#27222E` | Panels |
| raised | `#332C3B` | Chips and small buttons |
| hover | `#3B3445` | Hover, empty bar tracks |
| border | `#5A5166` | Input borders |
| text | `#F7F1E8` | Main text |
| muted | `#C5BBCF` | Secondary text |
| placeholder | `#A99EB5` | Placeholder text, neutral chart bars |

**Budget status**

| State | Colour |
|---|---|
| On track | `#7BE3B5` (mint) |
| Getting close | `#F6C156` (amber) |
| Over | `#FF8B7B` (coral) for fills, `#FF9E90` for coral text on dark |

**Categories**, in this fixed order, with starting limits that total 500.000 KWD:

| Category | Colour | Starting limit |
|---|---|---|
| Food | `#EE7F3B` | 110.000 |
| Transport | `#3D97EC` | 50.000 |
| Fun | `#9B6CF5` | 70.000 |
| Shopping | `#C9A227` | 55.000 |
| Papi | `#E8628F` | 25.000 |
| Bills | `#28AB9E` | 190.000 |

Category colours alone do not separate well for colour-blind readers, so always show the category's icon or name beside the colour. Icon paths are in `CATS` in `Main.dc.html`.

**Shape:** main card radius 36px (28px on phones), panels 22px, category tiles 12px, chips fully rounded. Touch targets are at least 44px.

## Screens

Today, Spending, Budgets, Insights and Papi. See the screenshots.

- **Desktop (860px and wider):** a top bar with the wordmark, a pill-shaped nav and the budget dates.
- **Phone (below 860px):** a five-item bottom nav, one column, and scrolling content.
- **Main card (the signature moment):** it fills with the status colour, shows the amount left in very large type, and Papi lies on it with his paws hanging over the bottom edge. Protect this. Keep the text clear of Papi at every width.

## Behaviour to keep

**Money**
- Store amounts as whole fils (1 KWD = 1000 fils) to avoid decimal errors.
- Always display three decimals, such as `289.700 KWD`.

**Budget status** (`spent%` = spent / total, `elapsed%` = how far through the budget period today is)
- Over: the amount left is below zero
- Getting close: `spent% - elapsed%` is above 12
- On track: otherwise
- A category shows "Close" at 75% of its limit or more, and "Over by X" above its limit

**Papi's mood**
1. Playful for about 3 seconds after adding a spending, unless over budget
2. Worried when over budget
3. Needy when getting close
4. Curious when on track and more than 5 points ahead of the pace, while he has an unanswered question
5. Content otherwise

**Quick add**
- `4.5 coffee` becomes an amount, a name and a guessed category, using the `KEYWORDS` list. The person can change the category before adding.
- Adding counts the main number down smoothly, makes Papi react, and shows a toast with Undo.
- Removing a spending also offers Undo.

**Budgets page**
- Warn when category limits add up to more than the monthly total, and show any unassigned amount.

**Papi's voice**
- Quiet, curious and warm, a little needy and playful. Short lines. He notices everything and never shames.
- Examples: "Three deliveries since Friday. Busy few days?", "Noted. Thank you.", "For me? Do it again.", "We went past the budget. Want to look at it together?"
- He has a "What Papi remembers" list, and the person can make him forget any item.

## What the prototype fakes, so build it properly

- **Dates:** the prototype hardcodes 25 Oct to 24 Nov, today as 3 Nov, 22 days left, and day 10 of 31. Calculate all of these from the real date and the person's payday.
- **Spending data:** `SEED` and "last month" (248.600) are samples. A real new person starts empty. Do not show sample data as if it were theirs.
- **Papi's question:** the delivery line is written for the sample data. Make it a rule based on real spending, and use only true statements.
- **Papi's chat:** the replies are scripted from real numbers using keyword matching. Keep that, behind one function the AI agent can replace later.
- **Usuals:** the chips are samples. Base them on the person's most frequent spendings.

## Missing from the design, so please add

Match the existing look, and show the owner your approach for these:

1. **Name entry (the first thing people see).** Papi on a mint circle, a clear labelled field, and one button. Something like "What should Papi call you?" then "Continue". No password. Remember the name on that device, offer a way to change it, and use the name somewhere warm, such as a greeting from Papi.
2. **First-time setup.** Ask for the monthly budget and payday, with suggested category limits the person can change.
3. **Empty states.** Today, Spending and Insights with no spendings. Tell the person what to do next, in Papi's voice where it fits.
4. **Editing a spending.** The prototype can only add and remove. Add editing the name, amount, category and date.
5. **Long lists and months.** Handle many spendings, and starting a new budget period.

## Quality bar

- Works from 360px phones up to wide desktops, with no sideways page scrolling
- Real buttons, links and labelled inputs, with visible keyboard focus and `aria-label`s on icon-only buttons
- Text contrast of at least 4.5:1
- Respect `prefers-reduced-motion`, as the prototype does
- Budget maths covered by tests: status, category state, per-day amount, and fils formatting
- No emoji in the interface. Use the inline icons
- Run it and compare each screen against the screenshots at desktop and phone sizes before calling it done

## Later, not now

- Deploying to Vercel, and any environment variables it needs
- Papi as a real AI agent, likely using the Claude API. Spending data should only ever reach it through server code, with API keys kept out of the browser and out of git
- Arabic with right-to-left layout. Avoid choices that would make it hard, such as hardcoded left and right spacing where logical properties would work
