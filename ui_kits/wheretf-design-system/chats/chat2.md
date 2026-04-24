# User switcher design

_Started 2026-04-23 15:39 UTC_

---

## User

Adding user switcher - sign in/out, etc. CUrrently, no bottom left affordance or controls exist in app. HOw do I show you what the whole app looks like? It's on the local dev server (not on internet).
For avatar: Placement: sidebar bottom
Trigger: avatar + name + upward caret
Menu: name/email/badges header → Settings (stub) → Sign out → dev-only Switch persona submenu with the 4 buttons
Switch persona: reuses signIn("dev-impersonate", …) — Auth.js overwrites the cookie, no explicit sign-out needed first
Open questions I flagged for you:

Plan badge → billing link, or display-only?
Settings scope — profile + org + notifications, or split?
Collapsed sidebar — avatar-only or hidden?

## Assistant

I'll help you design the user switcher / sidebar bottom control. Let me first understand what's in the project so I can match the existing design language.

_[tool: list_files]_

_[tool: read_file]_

I have strong context. Let me check the app UI kit to understand the existing sidebar design.

_[tool: list_files]_

_[tool: read_file]_

Now let me read the existing sidebar component and the app shell to match conventions.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

I have a clear picture. Let me answer your questions first, plan the design, then build.

_[tool: snip]_

## How to show me the whole app

Easiest path: take screenshots of the key screens in your dev server and drop them into the project via **Import → Files**. I can also work from a codebase import if you'd rather attach the repo. For this task I don't strictly need the whole app — I have the sidebar component and the design system — but seeing the surrounding screens helps me pick the popover anchor/shadow so it sits correctly on top of your real content.

## My answers to your open questions

Opinionated defaults, all exposed as Tweaks so you can flip them:

1. **Plan badge** → **display-only** in the header, with a subtle `Upgrade →` link underneath when on Free. Clicking the badge does nothing; clicking the link goes to billing. Why: clicking a plan label to get to billing is a fishy pattern — users expect a static label. The explicit upgrade link is on-brand ("name things directly").
2. **Settings scope** → **split, single top-level Settings entry**, which opens a full settings page with tabs for Profile, Workspace, Notifications, Billing, Keyboard. Stubbed in this design. Submenus-in-popovers get cramped fast.
3. **Collapsed sidebar** → **avatar-only**, popover opens to the right and carries all the same content. Hiding the account control when collapsed is hostile — sign-out is a "must-always-reach" control.

## Plan

Single HTML file, design_canvas with **4 artboards**:
- **A. Expanded sidebar — closed** (anchor, rest state) 
- **B. Expanded sidebar — menu open** (the main popover with all sections)
- **C. Collapsed sidebar — menu open** (avatar-only trigger, popover to the right)
- **D. States inventory** — hover, focus, pressed, loading (during persona switch), sign-out confirm

Menu structure (matches your spec):
```
┌─────────────────────────┐
│ [DM]  Drew DeMarco      │   header
│       drew@demarco...   │
│       [Free] [Owner]    │   badges (display-only)
│       Upgrade to Pro →  │   (Free only)
├─────────────────────────┤
│ ⚙  Settings             │
│ ◐  Appearance     ▸     │   light/dark — bonus, cheap to add
├─────────────────────────┤
│ ⇆  Switch persona  ▾    │   DEV-ONLY, labeled
│     · Free · Drew       │
│     · Pro · Taylor      │
│     · Pro Admin · Sam   │
│     · Support · Jules   │
├─────────────────────────┤
│ ⎋  Sign out             │
└─────────────────────────┘
  v1.4.2 · dev            footer
```

Building now.

_[tool: update_todos]_

Let me set up the folder and copy the starter + needed assets.

_[tool: copy_starter_component]_

_[tool: list_files]_

Now I'll build the UserSwitcher component and the canvas HTML.

_[tool: write_file]_

_[tool: snip]_

Now the CSS for the UserSwitcher. I'll put it in a dedicated file and add the missing icons.

_[tool: write_file]_

_[tool: snip]_

Now the main HTML with the design canvas hosting 4 artboards.

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Delivered **User Switcher.html** in `ui_kits/app/`. Five artboards on a design canvas:

- **A.** Anchor — trigger at rest
- **B.** Menu open — full popover with header, upgrade CTA (Free only), Settings/Appearance/Shortcuts, dev tools, Sign out
- **C.** Persona submenu open — dev-only, four personas with current-user check + loading spin state
- **D.** Collapsed sidebar — avatar-only trigger, popover opens to the right
- **E.** States inventory — rest / hover / open / collapsed / switching / sign-out confirm

My answers to your open questions (all Tweakable via the bottom-right panel when Tweaks is on):
1. **Plan badge** — display-only chip in the header; a separate `Upgrade to Pro →` CTA handles the billing link. Free tier only.
2. **Settings** — one top-level entry that opens a full settings page (stubbed); split into Profile/Workspace/Notifications/Billing/Keyboard tabs. Appearance and Keyboard Shortcuts surfaced as their own menu rows since they're frequent.
3. **Collapsed sidebar** — avatar-only. Hiding sign-out on collapse is hostile.

To show me the whole app: drop screenshots into the project (Import → Files) or attach the codebase. I worked from the sidebar component + design tokens, so the popover chrome should drop in cleanly.

## User

dev tools persona is a dev-only construct. Do not integrate so nicely / cleanly - it should be clearly a dev thing.

## Assistant

Good call. Let me make the dev tools look like a bolted-on debug panel, not native product UI.

_[tool: snip]_

_[tool: read_file]_

I'll rework the dev tools section to look like a bolted-on debug strip — a distinct visual language: monospace, warning-yellow caution tape, different background, "scaffolding" feel.

_[tool: str_replace_edit]_

_[tool: snip]_

Now replace the CSS for the dev block — make it visually distinct (warning yellow/caution, monospace, dashed, tape stripe).

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

Reworked the dev tools to look like a debug panel — caution-tape stripe, dashed yellow outline, terminal prompt with the actual `signIn("dev-impersonate", ...)` invocation, monospace persona list styled as terminal output with colored tokens. Clearly not product UI.

## User

A background task has completed. Here are the results:

## Assistant

_[tool: snip]_

Verified clean.

