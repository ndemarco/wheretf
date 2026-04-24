/* globals React */
/* UserSwitcher — sidebar-bottom account control.
   Trigger: avatar + name + upward caret (expanded) OR avatar-only (collapsed).
   Menu: header → (Platform admin if isAdmin) → Settings → Appearance → Dev impersonate → Sign out.
   Closes on Esc and outside click; returns focus to the trigger on close.
   (Not a real focus trap — only the trigger return. If you need a trap,
    wrap with focus-trap-react.)

   DATA CONTRACT
   -------------
   user.plan    — 'free' | 'pro' | 'paid' | null. Sourced from the active
                  org (orgs.plan), NOT from users. The shell must resolve
                  active-org at render time and pass it in.
   user.role    — 'Owner' | 'Admin' | 'Support' | null. Org-scoped. OIDC
                  users have null until provisioning completes; we show
                  "Member · pending setup" in that case.
   user.isAdmin — Platform-admin flag (users.isAdmin). Orthogonal to role.
                  Gates the "Platform admin" entry to /admin.
*/
const { useState: usState, useEffect: usEffect, useRef: usRef } = React;

/* Plan normalizer — API returns lower-case, UI displays title-case.
   'paid' is a legacy alias for 'pro'; collapse it. */
function normalizePlan(raw) {
  if (raw == null) return null;
  const v = String(raw).toLowerCase();
  if (v === 'pro' || v === 'paid') return 'Pro';
  if (v === 'free') return 'Free';
  // Passthrough for display strings we already formatted ('Free', 'Pro', '—').
  if (raw === 'Free' || raw === 'Pro' || raw === '—') return raw;
  return raw;
}

const DEV_PERSONAS = [
  { id: 'drew',   name: 'Drew DeMarco',  email: 'drew@demarcohome.com',    plan: 'Free',  role: 'Owner',  init: 'DM', isAdmin: false },
  { id: 'taylor', name: 'Taylor Reeves', email: 'taylor@parts-bench.test', plan: 'Pro',   role: 'Owner',  init: 'TR', isAdmin: false },
  { id: 'sam',    name: 'Sam Okafor',    email: 'sam@reloaders.test',      plan: 'Pro',   role: 'Admin',  init: 'SO', isAdmin: false },
  { id: 'jules',  name: 'Jules Park',    email: 'jules@wheretf.xyz',       plan: null,    role: 'Support',init: 'JP', isAdmin: true  },
  { id: 'oidc',   name: 'Pat (OIDC)',    email: 'pat@homelab.local',       plan: null,    role: null,     init: 'PT', isAdmin: false },
];

function Avatar({ init, size = 32, tone = 'brand' }) {
  const bg = tone === 'brand' ? 'var(--brand)' : 'var(--surface-2)';
  const fg = tone === 'brand' ? '#fff' : 'var(--fg)';
  return React.createElement('div', {
    className: 'us-avatar',
    style: { width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.42) }
  }, init);
}

function Badge({ children, tone = 'neutral' }) {
  return React.createElement('span', { className: `us-badge us-badge--${tone}` }, children);
}

function MenuRow({ icon, label, hint, onClick, danger, chev, caret, onMouseEnter }) {
  return React.createElement('button', {
    className: `us-row ${danger ? 'us-row--danger' : ''}`,
    onClick, onMouseEnter, type: 'button',
  },
    icon && React.createElement('i', { className: `ic ic-${icon} us-row__ic` }),
    React.createElement('span', { className: 'us-row__label' }, label),
    hint && React.createElement('span', { className: 'us-row__hint' }, hint),
    chev && React.createElement('i', { className: 'ic ic-chev-right us-row__chev' }),
    caret && React.createElement('i', { className: `ic ic-chev-${caret} us-row__chev` }),
  );
}

window.UserSwitcher = function UserSwitcher({
  user,
  collapsed = false,
  devMode = true,
  // Host/env info — no hardcoded 'localhost'
  devHost = (typeof location !== 'undefined' ? location.host : 'localhost:3000'),
  version = 'v0.0.0',
  buildChannel = 'dev build',
  onNavigate = () => {},
  onSignOut = () => {},
  onImpersonate = () => {},
  // Demo-only: force the popover open from parent (for artboard states)
  forceOpen = null,
  // Demo-only: pin the submenu open for artboard states
  forcePersonaOpen = false,
  // Demo-only: show a loading persona switch in progress
  switchingTo = null,
  // Demo-only: show error state after a failed switch
  switchError = null,
  // Demo-only: pin a hover row
  hoverRow = null,
  // Demo-only: show sign-out confirm
  forceSignOutConfirm = false,
}) {
  const [open, setOpen] = usState(false);
  const [personaOpen, setPersonaOpen] = usState(false);
  const [confirmSignOut, setConfirmSignOut] = usState(false);
  const isOpen = forceOpen !== null ? forceOpen : open;
  const isPersonaOpen = forcePersonaOpen || personaOpen;
  const isConfirm = forceSignOutConfirm || confirmSignOut;

  const rootRef = usRef(null);
  const popRef = usRef(null);
  const triggerRef = usRef(null);

  // Close handlers — Esc, outside click, and return focus to the trigger.
  usEffect(() => {
    if (!isOpen || forceOpen !== null) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false); setPersonaOpen(false); setConfirmSignOut(false);
        // Return focus to the trigger so keyboard users don't lose place.
        triggerRef.current && triggerRef.current.focus();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false); setPersonaOpen(false); setConfirmSignOut(false);
        triggerRef.current && triggerRef.current.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, forceOpen]);

  // Edge-detection: if the collapsed-right popover would overflow the viewport,
  // flip it to the left of the trigger.
  const [flip, setFlip] = usState(false);
  usEffect(() => {
    if (!isOpen || !collapsed || !popRef.current || !triggerRef.current) return;
    const tr = triggerRef.current.getBoundingClientRect();
    const popW = popRef.current.offsetWidth || 288;
    const vw = window.innerWidth;
    const wouldOverflow = tr.right + 6 + popW > vw - 8;
    const fitsLeft = tr.left - 6 - popW > 8;
    setFlip(wouldOverflow && fitsLeft);
  }, [isOpen, collapsed]);

  const planDisplay = normalizePlan(user.plan);
  const roleDisplay = user.role || null;

  const badges = [];
  if (planDisplay) badges.push(React.createElement(Badge, { key: 'plan', tone: planDisplay === 'Pro' ? 'brand' : 'neutral' }, planDisplay));
  if (roleDisplay) badges.push(React.createElement(Badge, { key: 'role', tone: 'outline' }, roleDisplay));
  if (user.isAdmin) badges.push(React.createElement(Badge, { key: 'admin', tone: 'danger' }, 'Platform admin'));

  const placement = collapsed ? (flip ? 'left' : 'right') : 'top';

  // Sub-line text: first-login OIDC users have no role yet.
  const subLine = !planDisplay && !roleDisplay
    ? 'Member · pending setup'
    : `${planDisplay || '—'} · ${roleDisplay || 'Member'}`;

  // ---------- Trigger ----------
  const trigger = collapsed
    ? React.createElement('button', {
        ref: triggerRef,
        className: `us-trigger us-trigger--collapsed ${isOpen ? 'is-open' : ''}`,
        onClick: () => setOpen(v => !v),
        'aria-haspopup': 'menu', 'aria-expanded': isOpen,
        title: `${user.name} · ${planDisplay || 'no plan'}`,
      }, React.createElement(Avatar, { init: user.init, size: 32 }))
    : React.createElement('button', {
        ref: triggerRef,
        className: `us-trigger ${isOpen ? 'is-open' : ''}`,
        onClick: () => setOpen(v => !v),
        'aria-haspopup': 'menu', 'aria-expanded': isOpen,
      },
        React.createElement(Avatar, { init: user.init, size: 32 }),
        React.createElement('div', { className: 'us-trigger__text' },
          React.createElement('div', { className: 'us-trigger__name' }, user.name),
          React.createElement('div', { className: 'us-trigger__sub' },
            planDisplay
              ? React.createElement('span', { className: `us-plan us-plan--${planDisplay === 'Pro' ? 'brand' : 'free'}` }, planDisplay)
              : null,
            planDisplay ? ' · ' : '',
            roleDisplay || (planDisplay ? 'Member' : 'Pending setup')
          ),
        ),
        React.createElement('i', { className: `ic ic-chev-up us-trigger__caret ${isOpen ? 'is-flipped' : ''}` }),
      );

  // ---------- Popover ----------
  const popover = isOpen && React.createElement('div', {
    ref: popRef,
    className: `us-pop us-pop--${placement}`,
    role: 'menu',
  },
    // Header
    React.createElement('div', { className: 'us-pop__head' },
      React.createElement(Avatar, { init: user.init, size: 40 }),
      React.createElement('div', { className: 'us-pop__ident' },
        React.createElement('div', { className: 'us-pop__name' }, user.name),
        React.createElement('div', { className: 'us-pop__email' }, user.email),
        React.createElement('div', { className: 'us-pop__badges' }, badges),
      ),
    ),

    // Upgrade strip (Free only) — display-only badge above, active link here
    user.plan === 'Free' && React.createElement('button', {
      className: 'us-upgrade',
      onClick: () => { onNavigate('billing'); setOpen(false); },
    },
      React.createElement('div', null,
        React.createElement('div', { className: 'us-upgrade__title' }, 'Upgrade to Pro'),
        React.createElement('div', { className: 'us-upgrade__sub' }, 'Unlimited modules & items'),
      ),
      React.createElement('i', { className: 'ic ic-chev-right' }),
    ),

    React.createElement('div', { className: 'us-sep' }),

    // Platform-admin entry — gated on users.isAdmin, orthogonal to org role.
    user.isAdmin && React.createElement('div', { className: 'us-group' },
      React.createElement(MenuRow, {
        icon: 'shield', label: 'Platform admin', hint: '/admin',
        onClick: () => { onNavigate('platform-admin'); setOpen(false); },
      }),
    ),

    // Main actions
    React.createElement('div', { className: 'us-group' },
      React.createElement(MenuRow, {
        icon: 'settings', label: 'Settings', hint: '⌘,',
        onClick: () => { onNavigate('settings'); setOpen(false); },
      }),
      React.createElement(MenuRow, {
        icon: 'sun', label: 'Appearance', hint: 'Auto',
        chev: true,
        onClick: () => onNavigate('appearance'),
      }),
      React.createElement(MenuRow, {
        icon: 'keyboard', label: 'Keyboard shortcuts', hint: '?',
        onClick: () => onNavigate('shortcuts'),
      }),
    ),

    // Dev-only persona switcher — intentionally jarring, scaffolded, NOT polished UI.
    // Caution-tape header, monospace, sits inside a dashed outline so it reads as
    // "this is not part of the product" at first glance.
    devMode && React.createElement('div', { className: 'us-devblock', role: 'group', 'aria-label': 'Developer tools' },
      React.createElement('div', { className: 'us-devblock__tape' },
        React.createElement('span', { className: 'us-devblock__tapetxt' }, 'DEV · NOT SHIPPED · DEV · NOT SHIPPED · DEV · NOT SHIPPED'),
      ),
      React.createElement('div', { className: 'us-devblock__head' },
        React.createElement('span', { className: 'us-devblock__tag' }, '[dev]'),
        React.createElement('span', { className: 'us-devblock__title' }, 'impersonate'),
        React.createElement('span', { className: 'us-devblock__host' }, devHost),
      ),
      React.createElement('button', {
        className: 'us-devblock__toggle',
        onClick: () => setPersonaOpen(v => !v),
        type: 'button',
      },
        React.createElement('span', { className: 'us-devblock__prompt' }, '$'),
        React.createElement('span', { className: 'us-devblock__cmd' },
          'signIn("dev-impersonate", ',
          React.createElement('span', { className: 'us-devblock__cmd-arg' }, `"${user.id}"`),
          ')'
        ),
        React.createElement('i', { className: `ic ic-chev-${isPersonaOpen ? 'down' : 'right'} us-devblock__caret` }),
      ),
      isPersonaOpen && React.createElement('ul', { className: 'us-devlist' },
        DEV_PERSONAS.map(p => {
          const isCurrent = p.id === user.id;
          const isLoading = switchingTo === p.id;
          const isErrored = switchError && switchError.personaId === p.id;
          const planLabel = normalizePlan(p.plan) || 'N/A';
          const roleLabel = p.role ? p.role.toLowerCase() : 'pending';
          return React.createElement('li', { key: p.id, className: 'us-devrow__wrap' },
            React.createElement('button', {
              className: `us-devrow ${isCurrent ? 'is-current' : ''} ${isLoading ? 'is-loading' : ''} ${isErrored ? 'is-errored' : ''}`,
              onClick: () => { if (!isCurrent && !isLoading) onImpersonate(p.id); },
              type: 'button',
            },
              React.createElement('span', { className: 'us-devrow__marker' },
                isLoading ? React.createElement('span', { className: 'us-devrow__spin' })
                : isErrored ? '!'
                : isCurrent ? '▸'
                : ' '
              ),
              React.createElement('span', { className: 'us-devrow__id' }, p.id.padEnd(7, ' ')),
              React.createElement('span', { className: 'us-devrow__plan' }, `[${planLabel}]`.padEnd(6, ' ')),
              React.createElement('span', { className: 'us-devrow__role' }, roleLabel + (p.isAdmin ? ' *admin' : '')),
            ),
            isErrored && React.createElement('div', { className: 'us-devrow__err' },
              `// ${switchError.message || 'switch failed — cookie not rewritten'}`
            )
          );
        })
      ),
      React.createElement('div', { className: 'us-devblock__note' },
        '// reuses signIn() — Auth.js overwrites the cookie'
      ),
    ),

    React.createElement('div', { className: 'us-sep' }),

    // Sign out (or confirmation)
    !isConfirm
      ? React.createElement('div', { className: 'us-group' },
          React.createElement(MenuRow, {
            icon: 'logout', label: 'Sign out', danger: true,
            onClick: () => setConfirmSignOut(true),
          }),
        )
      : React.createElement('div', { className: 'us-confirm' },
          React.createElement('div', { className: 'us-confirm__q' }, 'Sign out of this workshop?'),
          React.createElement('div', { className: 'us-confirm__row' },
            React.createElement('button', {
              className: 'btn btn--ghost',
              onClick: () => setConfirmSignOut(false),
            }, 'Cancel'),
            React.createElement('button', {
              className: 'btn btn--danger-solid',
              onClick: () => { onSignOut(); setOpen(false); setConfirmSignOut(false); },
            }, 'Sign out'),
          ),
        ),

    // Footer — version + channel are passed in by the shell (NEXT_PUBLIC_VERSION etc).
    React.createElement('div', { className: 'us-foot' },
      React.createElement('span', { className: 'wtf-code' }, version),
      React.createElement('span', { className: 'us-foot__dot' }),
      React.createElement('span', null, buildChannel),
    ),
  );

  return React.createElement('div', {
    ref: rootRef,
    className: `us-root ${collapsed ? 'us-root--collapsed' : ''} ${isOpen ? 'is-open' : ''}`,
  }, trigger, popover);
};

window.USER_SWITCHER_DEV_PERSONAS = DEV_PERSONAS;
