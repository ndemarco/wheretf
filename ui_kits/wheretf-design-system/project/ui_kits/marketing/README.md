# WhereTF · Marketing site kit

A React recreation of the marketing site at **wheretf.xyz**. Self-contained (React + Babel via CDN, project CSS tokens). Open `index.html`.

## Components

- `Primitives.jsx` — `WTFButton`, `WTFChip`, `WTFIcon`, `WTFWordmark`
- `MarketingNav.jsx` — sticky, blur-on-scroll header
- `Hero.jsx` — hero + live "find" showcase card
- `Sections.jsx` — How it works (4 steps) + Modules gallery
- `Pricing.jsx` — Free / Pro · Big CTA · Footer

## Notes

- Visual direction is inferred from the brand brief, **not** recreated from real site code. When the site is further along, resync.
- No real data, no real auth. The "Start free" button navigates to a placeholder that points at the app kit.
- Both themes work — the header ☀/☾ button toggles and persists to `localStorage`.
