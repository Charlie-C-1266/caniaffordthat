# The salary engine's monotonicity precondition

`grossFromNet` in `src/lib/salary.ts` inverts take-home back to gross by bisection.
That is only correct while `netFromGross` is **monotonically increasing**. Today it
is, so the code is sound as written — but the student loan and pension deductions
we have designed will break the assumption for one combination of inputs.

This note exists so that whoever adds those deductions changes the inversion at the
same time, rather than discovering the problem from a wrong answer.

## The combination that breaks it

Between £100,000 and £125,140 the personal allowance tapers at £1 for every £2
earned, so each extra pound of gross drags 50p of allowance into tax with it —
£1.50 taxed at 40%, or 60p per pound. Stacking the rest:

| Deduction                        | Per extra £1 |
| -------------------------------- | ------------ |
| Income tax in the taper band     | 60p          |
| National Insurance above £50,270 | 2p           |
| Plan 5 student loan              | 9p           |
| Postgraduate loan                | 6p           |
| **Total**                        | **77p**      |
| **Retained**                     | **23p**      |

23p is thin but positive. A **relief-at-source** pension is paid out of already-taxed
pay, so at rate `p` every extra £1 of gross costs a further `0.8 x p` of net. The
function stops increasing once:

```text
0.8p > 0.23   ->   p > 28.75%
```

At 30% the curve genuinely turns over: take-home falls from £33,067 at £100,000 to
£32,817 at £125,000 — £250 lower for £25,000 more gross.

The other arrangements are safe or nearly so. **Salary sacrifice can never break**:
its marginal is `(1 - p)(1 - marginalDeductionRate)`, which cannot go negative.
**Net pay** shields part of itself before income tax and only breaks past roughly
57.5%.

## Why this is a payslip effect, not a tax outcome

On an **annual** basis the dip does not exist. Once a higher-rate relief-at-source
contributor reclaims the extra relief through self-assessment, the contribution
costs 0.4 rather than 0.8 of each pound of gross — the position a net pay
arrangement reaches directly — and the threshold moves out to about 57.5%. The same
£100,000 to £125,000 move is then £6,250 **up** rather than £250 down.

This matters twice over:

- The engine models the payslip deliberately, because the tool answers a monthly
  affordability question and a refund next April cannot be spent in October. So the
  hazard is real for our code and must be handled.
- No user-facing copy may imply that anyone ends the **year** worse off for earning
  more. Where the taper commentary could read as "a raise made me poorer", the copy
  has to say _this month_ or _on your payslip_ explicitly.

## What to do about it

Prefer **bracket, then bisect**. We want the lowest gross that reaches the target,
so scan forward coarsely until the function crosses it, then bisect inside that
bracket alone. Within a single crossing the function is well behaved, and the answer
is the one a person would recognise. The cost is one cheap forward scan.

Capping the pension percentage below 28.75% is less code but forbids a legitimate
input — and a notable one, since contributing 30% or more precisely to duck below
£100,000 is exactly the behaviour the result card is meant to surface. Treat it as
the fallback, not the plan.

Whichever is chosen, add a test asserting first-crossing correctness across the full
domain with the taper band, both loans and a high relief-at-source rate all active at
once. That combination is the whole hazard; nothing narrower would catch it.

## Working

Figures are 2026/27, rest-of-UK bands, tax code 1257L, employment income, single
earner, percentages of full salary. They were computed from the band tables rather
than transcribed from a source. The 77% stack is corroborated independently by
published commentary on the £100k trap; the interaction with a percentage-based
relief-at-source contribution appears not to be written up anywhere, most likely
because it is a payroll-timing artefact rather than a tax result.

Fuller write-ups, including charts and the full decision record:

- Visual explainer — <https://claude.ai/code/artifact/7d1a4203-f181-46ec-a1bc-fcbda49f445c>
- Design plan — <https://app.notion.com/p/3c624a157886816a9b3dc9bc6430a3d2>
