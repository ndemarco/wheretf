"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Step = {
  id: string;
  title: string;
  copy: string;
  Visual: React.FC<{ active: boolean }>;
};

const AUTOPLAY_MS = 5000;

const steps: Step[] = [
  {
    id: "intro",
    title: "WhereTF",
    copy:
      "Remembers where you put your stuff so you don’t have to. Two-minute tour.",
    Visual: VisualIntro,
  },
  {
    id: "module",
    title: "Module",
    copy:
      "A top-level physical unit — a cabinet, a drawer chest, a shelving unit.",
    Visual: VisualModule,
  },
  {
    id: "level",
    title: "Level",
    copy: "Modules have levels: shelves, drawers, bays — each one addressable.",
    Visual: VisualLevels,
  },
  {
    id: "insert",
    title: "Insert",
    copy:
      "A movable organizer — a Plano box, a Gridfinity bin — slots into a receptacle level.",
    Visual: VisualInsert,
  },
  {
    id: "cell",
    title: "Cell",
    copy:
      "Inside the insert: cells. The smallest addressable slot where items live.",
    Visual: VisualCells,
  },
  {
    id: "item",
    title: "Item",
    copy:
      "Items — resistors, screws, glue — get assigned to a cell. That’s how you find them later.",
    Visual: VisualItem,
  },
  {
    id: "template",
    title: "Template",
    copy:
      "Every insert is built from a template. The template is the blueprint; the insert is the physical instance.",
    Visual: VisualTemplate,
  },
  {
    id: "go",
    title: "You’re ready",
    copy: "Create a module · place an insert · assign items.",
    Visual: VisualFinal,
  },
];

export default function TourPage() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (!playing) return;
    if (step >= steps.length - 1) return;
    timer.current = setTimeout(
      () => setStep((s) => Math.min(s + 1, steps.length - 1)),
      AUTOPLAY_MS
    );
    return clearTimer;
  }, [step, playing, clearTimer]);

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }, []);
  const prev = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);
  const restart = useCallback(() => {
    setStep(0);
    setPlaying(true);
  }, []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, togglePlay]);

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Visual = current.Visual;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 py-4 shrink-0">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              setStep(i);
              setPlaying(false);
            }}
            aria-label={`Go to step ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === step
                ? "w-8 bg-accent"
                : i < step
                  ? "w-1.5 bg-accent/50"
                  : "w-1.5 bg-slate-700 hover:bg-slate-600"
            }`}
          />
        ))}
      </div>

      {/* Slide */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6">
        <div
          key={current.id}
          className="w-full max-w-2xl flex flex-col items-center text-center animate-slide-in"
        >
          <div className="h-56 sm:h-72 w-full flex items-center justify-center mb-6">
            <Visual active />
          </div>
          <h2 className="text-4xl sm:text-5xl font-semibold text-slate-100 tracking-tight">
            {current.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-snug max-w-xl">
            {current.copy}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 p-6 flex items-center justify-center gap-2">
        <button
          onClick={prev}
          disabled={step === 0}
          className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        {!isLast ? (
          <button
            onClick={togglePlay}
            className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
          >
            {playing ? "Pause" : "Play"}
          </button>
        ) : (
          <button
            onClick={restart}
            className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
          >
            Restart
          </button>
        )}
        {isLast ? (
          <Link
            href="/modules/new"
            className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110"
          >
            Create your first module →
          </Link>
        ) : (
          <button
            onClick={next}
            className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110"
          >
            Next →
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.45s ease-out;
        }
      `}</style>
    </div>
  );
}

/* ---------- Visuals (inline SVG, each animates on mount) ---------- */

function VisualIntro({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="w-44 h-44">
      <circle
        cx={100}
        cy={100}
        r={70}
        fill="none"
        stroke="#ff6600"
        strokeWidth={3}
        strokeDasharray="440"
        strokeDashoffset={active ? 0 : 440}
        style={{
          transition: "stroke-dashoffset 1.2s ease-out",
        }}
      />
      <text
        x={100}
        y={110}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize={56}
        fontWeight={700}
        fontFamily="inherit"
      >
        ?
      </text>
    </svg>
  );
}

function VisualModule({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-56 h-56">
      <rect
        x={40}
        y={30}
        width={160}
        height={180}
        rx={6}
        fill="rgba(30,41,59,0.7)"
        stroke="#94a3b8"
        strokeWidth={3}
        style={{
          transform: active ? "scale(1)" : "scale(0.8)",
          transformOrigin: "center",
          transition: "transform 0.6s ease-out",
        }}
      />
    </svg>
  );
}

function VisualLevels({ active }: { active: boolean }) {
  const shelves = [60, 100, 140, 180];
  return (
    <svg viewBox="0 0 240 240" className="w-56 h-56">
      <rect
        x={40}
        y={30}
        width={160}
        height={180}
        rx={6}
        fill="rgba(30,41,59,0.7)"
        stroke="#94a3b8"
        strokeWidth={3}
      />
      {shelves.map((y, i) => (
        <line
          key={y}
          x1={50}
          y1={y}
          x2={190}
          y2={y}
          stroke="#ff6600"
          strokeWidth={2}
          style={{
            opacity: active ? 1 : 0,
            transition: `opacity 0.4s ease-out ${i * 0.18}s`,
          }}
        />
      ))}
    </svg>
  );
}

function VisualInsert({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-56 h-56">
      <rect
        x={40}
        y={30}
        width={160}
        height={180}
        rx={6}
        fill="rgba(30,41,59,0.7)"
        stroke="#94a3b8"
        strokeWidth={3}
      />
      {[60, 100, 140, 180].map((y) => (
        <line
          key={y}
          x1={50}
          y1={y}
          x2={190}
          y2={y}
          stroke="#475569"
          strokeWidth={2}
        />
      ))}
      {/* Insert dropping into a receptacle shelf */}
      <rect
        x={60}
        y={active ? 110 : -40}
        width={120}
        height={28}
        rx={3}
        fill="rgba(96,165,250,0.2)"
        stroke="#60a5fa"
        strokeWidth={2}
        style={{
          transition: "y 0.8s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      />
    </svg>
  );
}

function VisualCells({ active }: { active: boolean }) {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      cells.push({ r, c, delay: (r * 5 + c) * 0.05 });
    }
  }
  return (
    <svg viewBox="0 0 240 160" className="w-72 h-48">
      {cells.map(({ r, c, delay }) => (
        <rect
          key={`${r}-${c}`}
          x={20 + c * 40}
          y={20 + r * 40}
          width={32}
          height={32}
          rx={3}
          fill="rgba(30,41,59,0.7)"
          stroke="#60a5fa"
          strokeWidth={1.5}
          style={{
            opacity: active ? 1 : 0,
            transform: active ? "scale(1)" : "scale(0.5)",
            transformOrigin: `${36 + c * 40}px ${36 + r * 40}px`,
            transition: `opacity 0.35s ease-out ${delay}s, transform 0.35s ease-out ${delay}s`,
          }}
        />
      ))}
    </svg>
  );
}

function VisualItem({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 240 160" className="w-72 h-48">
      {[0, 1, 2, 3, 4].map((c) => (
        <rect
          key={c}
          x={20 + c * 40}
          y={60}
          width={32}
          height={32}
          rx={3}
          fill="rgba(30,41,59,0.7)"
          stroke="#475569"
          strokeWidth={1.5}
        />
      ))}
      {/* Item falling into the middle cell */}
      <circle
        cx={116}
        cy={active ? 76 : 10}
        r={8}
        fill="#fbbf24"
        style={{
          transition: "cy 0.7s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      />
      <rect
        x={100}
        y={60}
        width={32}
        height={32}
        rx={3}
        fill="rgba(251,191,36,0.1)"
        stroke="#fbbf24"
        strokeWidth={2}
        style={{
          opacity: active ? 1 : 0,
          transition: "opacity 0.4s ease-out 0.5s",
        }}
      />
    </svg>
  );
}

function VisualTemplate({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 320 180" className="w-96 h-56">
      {/* Template (blueprint on left) */}
      <rect
        x={20}
        y={30}
        width={120}
        height={120}
        rx={4}
        fill="none"
        stroke="#60a5fa"
        strokeWidth={2}
        strokeDasharray="6 4"
        style={{
          opacity: active ? 1 : 0,
          transition: "opacity 0.4s ease-out",
        }}
      />
      <text
        x={80}
        y={95}
        textAnchor="middle"
        fill="#60a5fa"
        fontSize={11}
        fontFamily="inherit"
      >
        template
      </text>
      {/* Arrow */}
      <line
        x1={150}
        y1={90}
        x2={180}
        y2={90}
        stroke="#ff6600"
        strokeWidth={2}
        markerEnd="url(#arr)"
        style={{
          opacity: active ? 1 : 0,
          transition: "opacity 0.35s ease-out 0.4s",
        }}
      />
      <defs>
        <marker
          id="arr"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff6600" />
        </marker>
      </defs>
      {/* Three inserts on the right */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={200 + i * 8}
          y={40 + i * 6}
          width={100}
          height={100}
          rx={4}
          fill="rgba(30,41,59,0.9)"
          stroke="#94a3b8"
          strokeWidth={2}
          style={{
            opacity: active ? 1 : 0,
            transition: `opacity 0.35s ease-out ${0.7 + i * 0.15}s`,
          }}
        />
      ))}
    </svg>
  );
}

function VisualFinal({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-56 h-56">
      <path
        d="M60 130 L100 170 L180 80"
        fill="none"
        stroke="#ff6600"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="200"
        strokeDashoffset={active ? 0 : 200}
        style={{
          transition: "stroke-dashoffset 0.9s ease-out",
        }}
      />
    </svg>
  );
}
