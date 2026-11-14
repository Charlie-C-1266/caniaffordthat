# The salary engine's monotonicity precondition

`grossFromNet` in `src/lib/salary.ts` turns take-home back into gross. It used to
bisect over the whole range, which is only correct while `netFromGross` is
**monotonically increasing**. With no deductions it is. The engine now also models
student loans and workplace pensions (`src/lib/deductions.ts`), though the site
doesn't ask for them yet, and one combination of them breaks that.

The inversion no longer depends on it: see
[What the code does about it](#what-the-code-does-about-it). This note records why
the curve can turn over, how the code copes, and what is still needed before a
deduction that turns it over can ship.

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

## What the code does about it

**Bracket, then bisect.** Take-home is a straight line between the points where some
base crosses a threshold: where tax starts, each income-tax band edge, the taper's
start and end, each NI band edge, and each student loan threshold. A pension moves
those points. Salary sacrifice and net pay lower the base income tax is charged on,
and salary sacrifice also lowers the base NI and student loans use. Each base is a
straight line in gross (`LinearBase` in `deductions.ts`), so a threshold maps back to
a gross salary exactly: divided by `1 - p` for a percentage, shifted by a fixed
amount. `slopeChangesOf` lists every such point in gross terms, plus where a fixed
contribution stops growing. `salariesForTakeHome` walks each stretch between them and
bisects inside any stretch whose two ends sit either side of the target. A stretch
can cross the target at most once, so this finds every salary that gives a
take-home, lowest first. `grossFromNet` returns the lowest, which is the answer a
person would recognise: every salary below it takes home less. (Take-home is floored
at £0 for a pension bigger than the payslip, which bends a stretch but never turns
it back, so the bisection still holds.)

A new deduction must add its own thresholds to `slopeChangesOf`, or a crossing
between two of them could be missed. `salary.test.ts` checks the search against a £5
scan on two made-up tables that turn over and on five pay profiles, including the
reference profile and fixed monthly pensions with both loans. It also checks the
answer is the first salary to reach each take-home, across the whole range, for
relief at source at 30%, 40% and 50% with both loans.

**The flip panel** (`salaryFlip` in `src/lib/reverse.ts`, drawn by
`src/components/result/SalaryFlip.tsx`) follows three rules:

- A salary typed in salary mode is used as typed, never worked back out of the
  take-home it produces.
- "Already enough" compares take-home, not salaries. Where the curve turns over, the
  lowest salary that reaches a target can sit below the user's own salary while
  their take-home still falls short of it.
- In take-home mode, when more than one salary gives the take-home entered, the panel
  shows no salary estimate and no pay-rise figure. It still says whether the plan
  fits, gives the gap in take-home, and suggests entering a salary instead.

A pay rise is measured to the next salary above the user's that reaches the target,
and the amount to spare down to the last one below it, where take-home would drop
under the target. While take-home rises with gross, both come to the required salary
minus the current one, as before.

**Payslip notes.** Where take-home stops rising, the panel explains what that does to
the figures. Every note says "on your payslip", so none of them can suggest anyone
ends the year worse off for earning more:

- **A stretch where pay takes home no more than its start.** `takeHomePlateauBelow`
  finds the last peak below the salary needed and where take-home climbs back to it.
  The panel then says pay between those two takes home no more than the peak does, so
  the first salary past that stretch to take home enough is the salary needed. This is
  the "salary needed jumps" case: just above the peak's take-home, the salary needed
  leaps from the peak to the far side of the dip.
- **A lower salary that reaches the target while the user's does not.** In salary
  mode, the lowest salary that takes home enough can sit below the user's own while
  their take-home falls short. The panel names both that salary and the next one above
  theirs.
- **The taper note.** It quotes "every extra £1 of take-home needs about £X of salary"
  only while at least 10p of an extra £1 is kept (`MIN_KEPT_TO_QUOTE`). Below that, the
  figure balloons (£33.33 at 3p, £166.67 at 0.6p), so the note says less than 10p is
  kept instead.

**A take-home no salary reaches.** At relief at source above about 47.5% with both
loans, each extra £1 above £125,140 costs more than £1 on the payslip (45% tax, 2% NI,
15% in loans, 40p of pension), so take-home has a ceiling: £17,067.40, reached at
£100,000, at 50%. A plan needing more has no salary at all. `salariesForTakeHome`
returns an empty list; `grossFromNet` returns the finite ceiling its search stopped
at, which must never reach the screen as a salary.

**Still to do before the site asks for these deductions.**

- The salary methodology page must explain, with live figures, why payslip take-home
  can fall as salary rises while the year's position still rises. The site publishes
  its working before its figures.
- The flip panel must pass the profile through, name the relief-at-source pension in
  the stretch note, and add that, over the whole year, once higher-rate relief is
  claimed back, earning more still leaves you better off.
- The flip panel must say plainly when no salary reaches a take-home, rather than
  show a salary.

The monotonicity sweep in `salary.test.ts` stays as the tripwire: it fails if a
shipped table turns over, and its message points here.

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
