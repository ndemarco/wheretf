# Working with Claude (or any capable AI) to take a POC to a well-architected system

A working guide distilled from the WhereTF build. Not theory — written while
the project itself was evolving from a rough idea into a structured codebase
with AI doing most of the typing.

The short version: the AI is a fast, confident, inexperienced collaborator.
Treat it like a brilliant intern who has never seen this codebase before and
doesn't care about the blast radius of what it's about to type. Your job is
to supply the judgment, the memory, and the accountability.

---

## The phases

POC → production is not a single refactor. It's a sequence with different
failure modes at each stage.

1. **Rough scaffold.** Everything works, nothing is trustworthy.
2. **Model settling.** Core nouns and verbs of the domain lock in. Schema
   stops churning daily.
3. **Interaction refinement.** UX surfaces drive new edges. Data model
   usually absorbs them without structural change — if it can't, you're
   back at #2.
4. **Correctness hardening.** Tests, constraints, transaction boundaries,
   cascades. The day you discover a bug that caused silent data loss is
   the day you realize #3 was premature.
5. **Cleanup + convention.** Duplication extracted, names normalized, types
   tightened, migrations idempotent, footguns guarded.

You don't get to skip phases. AI can accelerate each one by 3-10x, but
applying the wrong phase's habits to another phase is where things go
sideways. A POC with phase-5 discipline dies of ceremony. Production with
phase-1 discipline burns on contact.

---

## The core collaboration loop

Every meaningful change should pass through:

### 1. Capture

Get the problem into writing before any code is generated. A one-sentence
prompt is not a capture — it's a bet that the AI will infer the right
abstraction. It won't. It'll infer *an* abstraction and defend it.

Minimum viable capture: the problem, why it matters, what has been ruled
out, the constraint you most care about. Ideally in a living doc (this
project uses `specification/*-issues.md`) you can grep, reference, and
extend.

### 2. Clarify

Before generating code, the AI should list its clarifying questions and
*wait*. You should refuse to answer questions that feel like they're
trying to short-circuit a design decision. Answers that shape the data
model or the interaction are yours to make. Implementation details
(naming a helper, picking an internal data structure) are fine to delegate.

Heuristic: if the question starts with "should I" and the answer changes
the *observable* behavior of the system, answer it yourself. If it starts
with "how should I" and only changes internal structure, let the AI choose.

### 3. Plan

For anything non-trivial, get a plan back before any code lands. The plan
should be specific enough that you can predict the diff: files touched,
migrations added, API routes changed, tests added. A plan that reads
"I'll add the feature and test it" is not a plan.

Plans also serve as a commit-message draft. The best commits are plans
whose prose survived verbatim from the pre-code step.

### 4. Execute

Small commits, each one a single reversible unit. One schema change +
its migration + its backfill + its repo methods + its tests + its API
route + its UI hook is fine as a single commit *if* you can describe it
in one sentence. Two sentences = two commits.

The AI will sometimes want to fix adjacent things while it's in there.
Push back. "Just this thing, the other is a separate commit." The
blast radius of a compound commit is where most regression hunts end up.

### 5. Verify

Reality check the diff before trusting the green tests. Known traps:

- Tests that run but assert nothing meaningful.
- Tests that re-assert what the code does rather than what the *spec*
  requires.
- "Passed with 0 failures" on an empty suite.
- Integration tests that share state with the dev environment. (We hit
  this one — `npm test` was truncating the dev database because
  `DATABASE_URL` wasn't overridden. Running the suite wiped the user's
  workshop. This is the single best example of a POC habit — "it works
  on my machine, ship it" — surviving into production setup.)

For any PR that touches persistence, the check is: *can I point at the
single commit that introduces this state change, and does that commit
include the migration, the backfill, the repo method, and the test that
fails without the migration*? If any one is missing, you have drift in
flight.

---

## Habits that work

**Treat the issues doc as source of truth.** When the user says "capture
this, don't fix it yet" — that's an invitation to make the doc the
artifact. Code is how we respond to it. Over weeks, the doc accumulates
the real shape of the product.

**Answer questions inline in the conversation.** Every clarifying question
gets a one-line answer, then the plan is finalized. This keeps the
context small enough that the AI's working memory isn't overrun.

**Commit at sensible boundaries.** One commit per logical unit. Don't
batch. A single well-written commit message is the best documentation
you'll ever write, and it only exists when the commit is small enough
to need one sentence.

**Keep a running migration count.** If the project has `0007_foo.sql`,
the next one is `0008_bar.sql`. Never skip. Never rename. Write the
migration SQL by hand (or generate it and read it line by line). Let the
AI write the Drizzle schema — but the SQL, *you* own.

**Name the footguns.** When you hit one, write it down as a
caveat in the issue doc (or in the file the footgun lives in), and add
the fence in code. Silent data loss cannot be rediscovered — it has to
be *impossible*.

**Extract at three, not two.** Two copies of something is duplication
but not a problem yet. Three copies is a pattern. Four is a refactor.
Extracting at two produces the wrong abstraction half the time.

**Defer what you don't need.** Every sentence of the spec that can wait
should wait. The AI wants to be complete; completeness is the enemy of
shipping.

---

## Habits that go wrong

**Trusting generated code without reading it.** Even for "simple" things.
The AI will cheerfully write a transaction-log query that scans the
entire table, a React useEffect with a missing dep, a migration that
works on empty tables and silently truncates on populated ones.

**Letting the AI rewrite instead of edit.** Ask for an edit, get an edit.
Ask for "clean this up" and you'll get a full rewrite that loses context
you didn't know the file carried.

**Accepting a commit without reading the diff.** This is the single most
reliable way to introduce silent regressions. The AI will write confident
commit messages for commits that change things the message doesn't
mention.

**Treating the generated tests as ground truth.** The tests will be
against the implementation as written, not the spec. Your job is to
supply the tests — or at least the assertions — that reflect the spec
the code is trying to meet.

**Letting feature creep redefine the data model.** Every UI sketch looks
like it wants a new column. Most of them are variations on existing
columns. If you find yourself adding the third column to support a fourth
UI variation, stop. The model is wrong.

**Chasing the AI's confident wrong answer.** When the AI asserts a
framework behaves a certain way and you're 80% sure it doesn't, go
verify. Don't let the chat keep going with the wrong premise. It
*will* build a rococo house on the wrong foundation and defend every
brick.

---

## What the AI actually does well

- Boilerplate: schema + migration + repo + route + test for a new entity,
  in ~5 minutes of conversation. Do this often.
- Mechanical refactors: "rename X to Y across the codebase", "extract
  these three copies into a shared helper", "convert this SVG renderer
  to CSS Grid". High win rate when the before/after is well-defined.
- Reading unfamiliar code: ask it to survey a module and describe what
  it sees, check its reading against reality. Much faster than doing it
  by hand, given you read the summary critically.
- Test scaffolding: spinning up the boilerplate for a test case, letting
  you fill in the assertions.
- Commit messages: a good prompt + the diff → a respectable message.

## What it does poorly

- Anything involving judgment about tradeoffs. It will produce a
  recommendation with confident framing whether or not it has the
  information to make one. Always ask it to list the tradeoffs before
  acting.
- State that's subtle. Event loops, race conditions, transaction
  isolation, cascading deletes. The wrong choice looks identical to the
  right choice until the 10th user.
- Distinguishing POC shortcuts from load-bearing architecture. It will
  happily reach into a core abstraction to patch a UI bug because the
  fix "fits better there".
- Long-running context. Give it 500 lines of prior decisions and ask for
  the 501st — it may contradict decision 37. Keep the durable decisions
  in a file, not only in the chat.

---

## Signal that the project is on the right track

- **Spec files grow faster than code.** If you're churning specs, you're
  preventing churn in code.
- **Commits are small and easy to name.** The commit title = the feature.
- **Tests are numerous and fast.** You run them often. They're honest
  (they'd catch the thing the feature prevents).
- **The migrations log is clean.** Sequential, each one explainable, none
  destructive.
- **Naming stays stable.** When you see a word in a commit message, you
  know what part of the system it refers to.
- **Deletion works correctly.** You can delete any entity and the
  transaction log records the cascade. Nothing orphans.

## Signal the project is drifting

- **Recurring "oh, right" bugs.** Same kind of mistake in a new place.
  Missing constraint, duplicated logic, inconsistent name. → Invest in a
  convention + a lint or test that enforces it.
- **Commits that touch six areas.** Either the change is too big or the
  areas are wrongly separated.
- **You'd rather rewrite a feature than read it.** The AI made it in the
  first place; it shouldn't be unreadable after a week. Read + simplify
  before extending.
- **You can't remember why a column exists.** Go annotate it. Migration
  comments are cheap.
- **You avoid running tests because they're slow or flaky.** A test
  suite you don't trust is a test suite you don't run.

---

## Minimum guardrails for production-readiness

A POC graduating to production needs all of these in place. None is
optional. AI can write all of them in an afternoon; you need to ask.

1. **Test DB is not the dev DB.** Verified by a guard that refuses to
   run destructive operations on any DB whose name doesn't contain
   `test`. (We caught this the hard way.)
2. **Migrations are numbered and append-only.** No rewriting history.
3. **Every destructive action is logged.** Transaction log with
   before/after state, type-discriminated.
4. **Every cascade is explicit.** Either an FK `ON DELETE CASCADE` or a
   repo method that does the cleanup in a transaction.
5. **Every API error has a status code that lets the UI distinguish
   kinds.** 409 for "state conflict", 404 for "not found", etc. Not
   everything is 400.
6. **Every state transition has a test that tries to violate the
   invariant and expects a throw.** Not just the happy path.
7. **No magic strings for enums.** Either a literal union type or a
   database check constraint.
8. **Secrets are not in the repo.** `.env.local.example`, not
   `.env.local`.
9. **The README (or equivalent) tells a new developer how to seed, how
   to run tests, and what service the dev DB runs on.**
10. **When a feature is deferred, it's noted somewhere retrievable
    — not just in commit history.**

---

## One last thing

The AI will say "shipped" when what it means is "the code compiled and
the tests I wrote passed". Your sign-off is different — "this changes
the behavior of the system in the way I intended, nothing else, and I
understand every line of the diff." Those are not the same event.

Ship on your own terms. The AI is the keyboard, not the architect.
