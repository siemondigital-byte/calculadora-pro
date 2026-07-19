# Calculadora de Viabilidad Inmobiliaria Pro

Interactive, bilingual (ES/EN) real-estate viability calculator — the app bundled
with *Ciclo de Riqueza Inmobiliaria*. Implemented from
`../project/design_handoff_calculadora_pro/` (README + `Calculadora Pro.dc.html`).

## Files
- `index.html` — markup for the login screen and the calculator.
- `styles.css` — all design tokens, layout and component styles.
- `app.js` — state, the calculation engine (aligned with the book's method — see
  below), live rendering, i18n and responsive behavior.

No build step, no dependencies. Open `index.html` in a browser, or serve the folder
from any static host.

## What it does
- **Login → calculator.** In this build any credentials sign you in (the handoff
  marks auth as a production add-on); **Log out** returns to login.
- **Live compute.** Every input change recomputes all six result modules on
  `input` (sliders update while dragging, number fields while typing).
- **Projects (any location).** Manage a portfolio of projects — add, name (with
  location + currency), switch, delete. Your personal situation (income, expenses,
  debts, capital, horizon) is shared across all of them; each project carries its
  own opportunity + financing. Everything persists in `localStorage`.
- **Seven modules:** IRR on equity (TIR) with a benchmark verdict, debt capacity
  **with the handover mortgage**, taxes & deferral, Economic Security Number,
  valuation scenarios, capital projection chart, and a **project comparison** that
  flags each project as Viable / Review.

## Debt capacity & the handover mortgage

Pre-construction deals are paid in two phases, and the calculator models both
(Cap. 30):
- **During construction** you pay the down payment spread over the interest-free
  plan — shown as the monthly construction installment vs. your free cash flow.
- **At handover** you finance the remaining balance. Choose **Bank** (set interest
  rate + term → amortized payment) or **Developer** financing (often 0%, shorter
  term — as some Dubai projects offer). The card checks that payment against your
  healthy capacity (**35% of gross income − existing debts**) and tells you whether
  you can actually access the mortgage.

## Alignment with the book's method

The engine follows the method taught in *Ciclo de Riqueza Inmobiliaria* (the book
this app ships with). Where the book supersedes the original prototype handoff, the
book wins:

- **Economic Security Number (Cap. 7).** Monthly spend is projected to the horizon
  by inflation (3%), divided by a conservative **1%/month** portfolio return
  (≈12%/yr), then multiplied by the book's **×1.25 safety margin** — not the
  prototype's flat 5%.
- **Valuation scenarios (Cap. 9, new module).** Conservative / Base / Optimistic
  (the book's 15/25/35 ratio, anchored on your chosen rate), each with its own IRR,
  plus the **Regla de Oro**: only invest if the conservative case still clears 15%.
- **IRR verdict (Cap. 9 benchmarks).** Alert (<12%) · Market standard (12–20%) ·
  **Atlantis Standard** (≥20%) · Alpha (≥35%). 20% is the book's threshold for a
  "smart" investment.
- **Markets (Cap. 4/45/47).** The core markets of the method — Colombia, Dominican
  Rep., Mexico, Dubai, Panama, Costa Rica (Madrid is not a market in the book) —
  with a **currency-risk** tag on local-currency markets and the hard-currency 40–50%
  rule.

## Decisions carried over from the handoff
- **Device frames dropped.** The browser-window / phone bezel and the
  Desktop/Mobile toggle were prototype packaging. This build is naturally
  responsive: desktop shows inputs + results side by side; below 900px it becomes
  a single column with a `Datos / Inputs` ↔ `Resultados / Results` tab control.
- **Language is a real setting.** The ES/EN switch (in the login card and the app
  header) drives every label plus number formatting: `de-DE` (`1.234,5`) for ES,
  `en-US` (`1,234.5`) for EN. All values illustrative; the disclaimer is always shown.
- **`support.js` (the design-tool runtime) was not ported** — the app is plain
  HTML/CSS/JS, matching the rest of the project's exports.

## Wiring for production
- Replace the demo login with real auth; persist the user's last scenario.
- The calculation engine in `app.js` (`compute()`) is the source of truth. The
  chapter references above document why each formula is what it is.
- **Not yet done (Tanda 2):** IRR is still annualized (`multiple^(1/H)−1`). The book
  (Cap. 54) asks for IRR computed from the *real timing of the monthly installments*
  — a proper cash-flow IRR. That is the one structural change left to make.
