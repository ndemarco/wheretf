// Single source of truth for dev-impersonate personas. Consumed by:
//   - db/seed.ts             — creates users + org memberships
//   - app/login/page.tsx     — renders the one-click sign-in buttons
//   - app/components/UserSwitcher — the "switch persona" submenu
//
// Non-prod only. Never load this in a production request path.

export type DevPersonaRole = "admin" | "member";

export type DevPersona = {
  id: string;
  email: string;
  name: string;
  init: string;
  role: DevPersonaRole;
  isAdmin: boolean;
};

export const DEV_PERSONAS: readonly DevPersona[] = [
  {
    id: "drew",
    email: "drew@demarcohome.com",
    name: "Drew DeMarco",
    init: "DM",
    role: "member",
    isAdmin: false,
  },
  {
    id: "sam",
    email: "sam@reloaders.test",
    name: "Sam Okafor",
    init: "SO",
    role: "admin",
    isAdmin: false,
  },
  {
    id: "jules",
    email: "jules@wheretf.xyz",
    name: "Jules Park",
    init: "JP",
    role: "member",
    isAdmin: true,
  },
];
