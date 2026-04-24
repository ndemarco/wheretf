# Design System Update

_Started 2026-04-23 17:12 UTC_

---

## User

The app is using old logos, fonts, design assets. Explain to the implementer whatis necessary to implement the changes. Need to see what it ilooks like today?

## Assistant

I'll check what's currently in the User Switcher and compare it to the design system to identify what needs updating.

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: read_file]_

_[tool: show_to_user]_

Perfect! Now I can see what needs updating. Let me create a comprehensive implementation guide for you.

## WhereTF Design System Update — Implementation Guide

### What needs to change in the User Switcher (and broader app UI kit)

---

## **1. Logo & Brand Assets**

### Current State:
- Using `assets/monogram.svg` (the old pin-drop logo from the original upload)
- References to old logo throughout the app

### What to Update:
**Adopt the new "Tag-drop" logo** (`logo-mark-D-tag.svg`) as specified in the design system README:

```html
<!-- OLD (line 190 in User Switcher.html) -->
<img src="../../assets/monogram.svg" width={22} height={26} alt="" />

<!-- NEW -->
<img src="../../assets/logo-mark-D-tag.svg" width={22} height={26} alt="" />
```

**Files affected:**
- `ui_kits/app/User Switcher.html` (lines 190, 196)
- `ui_kits/app/AppSidebar.jsx` (if it exists)
- `ui_kits/app/index.html`
- Any other components using the brand mark

**Copy these assets into the current project:**
```
/projects/866b8ed5-7e7c-47a2-9055-8dda07160de8/assets/logo-mark-D-tag.svg
/projects/866b8ed5-7e7c-47a2-9055-8dda07160de8/assets/wordmark-horizontal.svg
```

---

## **2. Color System**

### Current State:
- Using `colors_and_type.css?v=3` which has **outdated dark theme colors**
- Current dark theme uses warm ink tones (`#0f0d0b`)
- App is referencing old color tokens

### What to Update:
**The dark theme has been completely redesigned** from warm ink to **cool navy-blue workshop aesthetic**:

```css
/* OLD dark theme (warm) */
--bg: #0f0d0b;
--bg-soft: #0b0a08;

/* NEW dark theme (cool navy) */
--bg: #0f1623;          /* deep navy */
--bg-soft: #0b111c;     /* darker navy for sidebar */
--surface: #151d2c;     /* panels, cards */
--surface-2: #1c2636;   /* hover states */
```

**Action required:**
1. **Replace** `ui_kits/app/../colors_and_type.css` with the version from `/projects/866b8ed5-7e7c-47a2-9055-8dda07160de8/colors_and_type.css`
2. The new version includes the **complete navy redesign** for dark mode
3. Update version param: `colors_and_type.css?v=4` (or remove caching)

---

## **3. Typography**

### Current State:
- Correctly using Space Grotesk + JetBrains Mono
- Pulling from Google Fonts (temporary)

### What to Update:
**Fonts are correct, but the delivery method should eventually change:**

The design system notes:
> "Real font files (currently pulling Space Grotesk + JetBrains Mono from Google Fonts). Drop TTFs into `fonts/` and swap `@font-face`."

**For now:** No immediate change needed. Google Fonts is acceptable.

**Future:** When you have licensed font files, replace the `@import` in `colors_and_type.css` with local `@font-face` declarations.

---

## **4. Icons**

### Current State:
- Using inline SVG data URIs in `app.css` for icons
- Lucide-style stroke icons embedded in CSS

### What to Update:
**The design system has a custom 24-icon set** at 2.5px stroke weight in `/projects/.../assets/icons/`

**Two options:**

### Option A: Keep current inline approach (faster)
No change needed — current icons are fine and match the 2.5px stroke spec.

### Option B: Use the design system icons (higher fidelity)
Replace CSS mask icons with direct references:

```jsx
// Instead of:
<i className="ic ic-grid" />

// Use:
<img src="../../assets/icons/grid.svg" width={18} height={18} alt="" />
```

**Copy needed icons from:**
```
/projects/866b8ed5-7e7c-47a2-9055-8dda07160de8/assets/icons/
```

---

## **5. Updated Colors Reference**

Here's the complete mapping of what changed:

| Token | OLD (warm ink) | NEW (navy) |
|-------|----------------|------------|
| `--bg` | `#0f0d0b` | `#0f1623` |
| `--bg-soft` | `#0b0a08` | `#0b111c` |
| `--surface` | `#1a1816` | `#151d2c` |
| `--surface-2` | `#242120` | `#1c2636` |
| `--surface-sunk` | `#0f0d0b` | `#0a0f1a` |
| `--fg` | `#f5f3ef` | `#e6ebf3` |
| `--fg-2` | `#b8b3aa` | `#a9b3c2` |
| `--fg-3` | `#767066` | `#6b7687` |
| `--line` | `#2a221c` | `#1f2838` |
| `--brand` | `#ff6600` | `#ff6a1a` |
| `--brand-ink` | `#ff9947` | `#ff8a42` |

---

## **Implementation Checklist**

### High Priority (Visual Breaking Changes):
- [ ] Copy `logo-mark-D-tag.svg` into this project's assets
- [ ] Replace `monogram.svg` references with `logo-mark-D-tag.svg`
- [ ] Copy updated `colors_and_type.css` from design system project
- [ ] Bump CSS version query param to force refresh
- [ ] Test dark mode — colors should shift from warm brown to cool navy

### Medium Priority (Refinement):
- [ ] Review all icon usage against design system icon set
- [ ] Copy needed icons from `/projects/.../assets/icons/`
- [ ] Update favicon to use new logo if needed

### Low Priority (Future):
- [ ] Replace Google Fonts with local font files when available
- [ ] Add proper `@font-face` declarations

---

## **How to verify the changes:**

1. **Logo**: Should see the "tag-drop" shape (luggage tag → pin) instead of the pin-drop with component characters
2. **Dark mode**: Background should be **navy-blue** (`#0f1623`), not warm brown (`#0f0d0b`)
3. **Orange**: Should be slightly warmer/brighter in dark mode (`#ff6a1a` vs `#ff6600`)
4. **Consistency**: All files should reference the same design system version

---

## **Quick Start Command Sequence:**

```bash
# 1. Copy the updated color system
copy_files from design system: colors_and_type.css

# 2. Copy the new logo
copy_files from design system: assets/logo-mark-D-tag.svg

# 3. Find/replace in all .html and .jsx files:
"monogram.svg" → "logo-mark-D-tag.svg"

# 4. Update CSS import version or clear cache
```

---

**Want me to make these changes for you right now?** I can update all the files automatically, or you can use this guide to implement them yourself.

