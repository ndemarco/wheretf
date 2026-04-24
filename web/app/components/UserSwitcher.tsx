"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { DevPersona } from "@/lib/auth/dev-personas";

export type UserSwitcherUser = {
  id: string;
  name: string;
  email: string;
  init: string;
  plan: "free" | "pro" | null;
  role: "admin" | "member" | null;
  isAdmin: boolean;
};

type Props = {
  user: UserSwitcherUser;
  devMode: boolean;
  personas: ReadonlyArray<DevPersona>;
  onSignOut: () => Promise<void>;
  onImpersonate: (personaId: string) => Promise<void>;
};

function Avatar({ init, size = 32 }: { init: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full bg-accent text-white font-bold shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {init}
    </div>
  );
}

export function UserSwitcher({
  user,
  devMode,
  personas,
  onSignOut,
  onImpersonate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPersonaOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPersonaOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const planDisplay = user.plan === "pro" ? "Pro" : user.plan === "free" ? "Free" : null;
  const roleDisplay = user.role ? user.role[0].toUpperCase() + user.role.slice(1) : null;
  const subLine = !planDisplay && !roleDisplay
    ? "Pending setup"
    : `${planDisplay ?? "—"} · ${roleDisplay ?? "Member"}`;

  function navigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  function triggerImpersonate(personaId: string) {
    if (switchingTo || personaId === user.id) return;
    setSwitchingTo(personaId);
    startTransition(async () => {
      try {
        await onImpersonate(personaId);
      } catch {
        setSwitchingTo(null);
      }
      // On success the page navigates away; no cleanup needed.
    });
  }

  function triggerSignOut(e: MouseEvent) {
    e.preventDefault();
    setOpen(false);
    startTransition(async () => {
      await onSignOut();
    });
  }

  return (
    <div
      ref={rootRef}
      className="relative border-t border-slate-700/60 mt-2 pt-2 px-2"
    >
      <button
        ref={triggerRef}
        type="button"
        className={`flex items-center gap-2.5 w-full rounded-lg px-2 py-1.5 text-left transition-colors border ${
          open
            ? "bg-slate-800 border-slate-600"
            : "bg-transparent border-transparent hover:bg-slate-800 hover:border-slate-700"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar init={user.init} size={32} />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="text-sm font-semibold text-slate-100 truncate">
            {user.name}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {planDisplay && (
              <span
                className={`font-bold tabular-nums ${
                  planDisplay === "Pro" ? "text-accent" : "text-slate-300"
                }`}
              >
                {planDisplay}
              </span>
            )}
            {planDisplay && " · "}
            {roleDisplay ?? (planDisplay ? "Member" : "Pending setup")}
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%-2px)] left-2 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden p-1.5 z-50"
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-3 py-3">
            <Avatar init={user.init} size={40} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-100 truncate">
                {user.name}
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate mb-2">
                {user.email}
              </div>
              <div className="flex gap-1 flex-wrap">
                {planDisplay && (
                  <Badge tone={planDisplay === "Pro" ? "brand" : "neutral"}>
                    {planDisplay}
                  </Badge>
                )}
                {roleDisplay && <Badge tone="outline">{roleDisplay}</Badge>}
                {user.isAdmin && <Badge tone="danger">Platform admin</Badge>}
              </div>
            </div>
          </div>

          <Separator />

          {user.isAdmin && (
            <>
              <MenuRow
                icon="shield"
                label="Platform admin"
                hint="/admin"
                onClick={() => navigate("/admin")}
              />
              <Separator />
            </>
          )}

          <MenuRow
            icon="settings"
            label="Settings"
            hint="⌘,"
            onClick={() => navigate("/settings")}
          />
          <MenuRow icon="sun" label="Appearance" hint="soon" disabled />
          <MenuRow
            icon="keyboard"
            label="Keyboard shortcuts"
            hint="soon"
            disabled
          />

          {devMode && (
            <div className="mt-2 mb-1 border border-dashed border-amber-500/50 rounded-sm bg-amber-500/[0.03] font-mono">
              <div className="px-2.5 py-1 border-b border-amber-500/40 bg-amber-500/10 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-400">
                <span>DEV · NOT SHIPPED</span>
                <span className="text-slate-400 font-medium normal-case tracking-normal">
                  {typeof window !== "undefined"
                    ? window.location.host
                    : "local"}
                </span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 w-full px-2.5 py-2 text-[11px] text-slate-300 hover:bg-slate-900 text-left"
                onClick={() => setPersonaOpen((v) => !v)}
              >
                <span className="text-amber-400 font-bold">$</span>
                <span className="flex-1 truncate">
                  impersonate <span className="text-green-400">{user.id}</span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3 h-3 text-amber-400 shrink-0"
                >
                  {personaOpen ? (
                    <polyline points="6 9 12 15 18 9" />
                  ) : (
                    <polyline points="9 6 15 12 9 18" />
                  )}
                </svg>
              </button>
              {personaOpen && (
                <ul className="bg-slate-950 border-t border-amber-500/30 py-1">
                  {personas.map((p) => {
                    const isCurrent = p.email === user.email;
                    const isLoading = switchingTo === p.id;
                    const planLabel =
                      p.isAdmin || isCurrent ? "Pro" : "Pro"; // Bench org is Pro
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={isCurrent || isLoading || pending}
                          className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] text-left ${
                            isCurrent
                              ? "text-slate-500 cursor-default"
                              : isLoading
                              ? "text-slate-400 cursor-wait"
                              : "text-slate-200 hover:bg-slate-900"
                          }`}
                          onClick={() => triggerImpersonate(p.id)}
                        >
                          <span className="w-3 text-accent shrink-0">
                            {isLoading ? (
                              <Spinner />
                            ) : isCurrent ? (
                              "▸"
                            ) : (
                              " "
                            )}
                          </span>
                          <span className="w-16 text-slate-300 shrink-0">
                            {p.id}
                          </span>
                          <span className="w-12 text-slate-500 shrink-0">
                            [{planLabel}]
                          </span>
                          <span className="flex-1 text-slate-400 truncate">
                            {p.role}
                            {p.isAdmin && (
                              <span className="text-amber-400"> *admin</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="px-2.5 py-1 text-[10px] text-slate-500 border-t border-amber-500/20">
                // reuses signIn() — Auth.js overwrites the cookie
              </div>
            </div>
          )}

          <Separator />

          <MenuRow
            icon="logout"
            label="Sign out"
            onClick={triggerSignOut}
            danger
          />
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="h-px bg-slate-700/60 my-1" />;
}

function Badge({
  tone,
  children,
}: {
  tone: "brand" | "neutral" | "outline" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    brand: "bg-accent/10 text-accent border border-accent/40",
    neutral: "bg-slate-700 text-slate-300",
    outline: "bg-transparent text-slate-400 border border-slate-600",
    danger: "bg-rose-500/15 text-rose-300 border border-rose-500/40",
  };
  return (
    <span
      className={`inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  icon: "settings" | "sun" | "keyboard" | "shield" | "logout";
  label: string;
  hint?: string;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13px] font-medium text-left transition-colors ${
        disabled
          ? "text-slate-500 cursor-default"
          : danger
          ? "text-rose-400 hover:bg-rose-500/10"
          : "text-slate-200 hover:bg-slate-700/50"
      }`}
    >
      <Icon name={icon} className="w-4 h-4 shrink-0 opacity-70" />
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="text-[11px] font-mono text-slate-500 px-1.5 py-0.5 border border-slate-700 bg-slate-900 rounded">
          {hint}
        </span>
      )}
    </button>
  );
}

function Icon({
  name,
  className,
}: {
  name: "settings" | "sun" | "keyboard" | "shield" | "logout";
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
      </>
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-slate-600 border-t-accent animate-spin" />
  );
}
