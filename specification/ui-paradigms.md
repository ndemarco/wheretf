# UI Paradigms

Cross-cutting UI/UX rules that apply to all WhereTF interfaces.

---

## No Right-Click

WhereTF does not use right-click context menus. All actions must be reachable through visible UI elements — buttons, icons, inline controls. Context menus are invisible, undiscoverable, and inconsistent across devices (no right-click on tablets).

---

## Undo, Not Confirm

Destructive actions execute immediately with an undo toast. No confirmation dialogs. The toast auto-dismisses after a timeout. This keeps the user in flow — the cost of an accidental action is one click to undo, not a modal interrupting every deliberate action.

---

## Selection

- Click to select, click again to deselect.
- Ctrl+click for multi-select.
- Selection is visually distinct (accent border/highlight).
