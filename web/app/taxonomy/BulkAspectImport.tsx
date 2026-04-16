"use client";

import { useState } from "react";

interface ParsedParam {
  name: string;
  slug: string;
  dataType: string;
  unit: string | null;
  enumValues: string[];
  keep: boolean;
}

interface ParsedAspect {
  name: string;
  params: ParsedParam[];
  keep: boolean;
}

const UNIT_PATTERNS: [RegExp, string][] = [
  [/\bohms?\b/i, "ohm"],
  [/\bΩ\b/, "ohm"],
  [/\bppm\/°C\b/i, "ppm/°C"],
  [/\bppm\/V\b/i, "ppm/V"],
  [/\bµV\/V\b/i, "µV/V"],
  [/\bmm\b/, "mm"],
  [/\bin\b/, "in"],
  [/\b°C\b/, "°C"],
  [/\bW\b/, "W"],
  [/\bV\b/, "V"],
  [/\bA\b/, "A"],
  [/\bHz\b/, "Hz"],
  [/\bF\b/, "F"],
  [/\b%\b/, "%"],
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function inferParam(line: string): ParsedParam {
  const parenMatch = line.match(/^(.+?)\s*\((.+)\)\s*$/);
  const rawName = parenMatch ? parenMatch[1].trim() : line.trim();
  const hint = parenMatch ? parenMatch[2].trim() : "";

  const slug = slugify(rawName);
  let dataType = "text";
  let unit: string | null = null;
  let enumValues: string[] = [];

  if (hint) {
    // Check for comma-separated list (3+ items or 2 items that don't look like units)
    const parts = hint.split(",").map((s) => s.trim());
    const looksEnum =
      parts.length >= 3 ||
      (parts.length === 2 &&
        !parts.some((p) =>
          UNIT_PATTERNS.some(([re]) => re.test(p))
        ));

    if (looksEnum) {
      dataType = "enum";
      enumValues = parts;
    } else {
      // Try to find a unit
      for (const [re, u] of UNIT_PATTERNS) {
        if (re.test(hint)) {
          dataType = "numeric";
          unit = u;
          break;
        }
      }
    }
  }

  // Heuristic overrides from the name itself
  if (
    /\brating\b|\bvoltage\b|\bpower\b|\btemperature\b|\bresistance\b|\bcapacitance\b|\bwidth\b|\bheight\b|\blength\b|\bsize\b/i.test(
      rawName
    ) &&
    dataType === "text"
  ) {
    dataType = "numeric";
  }
  if (/\bstatus\b|\blevel\b|\btype\b|\bstyle\b|\bgrade\b|\bcode\b/i.test(rawName) && dataType === "numeric") {
    dataType = "text";
  }

  return { name: rawName, slug, dataType, unit, enumValues, keep: true };
}

function parseText(text: string): ParsedAspect[] {
  const lines = text.split("\n");
  const aspects: ParsedAspect[] = [];
  let current: ParsedAspect | null = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Detect section header: no leading bullet/dash, typically short, often has "/" or "—"
    const isBullet = /^[-•*]\s|^\d+[\.\)]\s/.test(trimmed);
    const stripped = trimmed.replace(/^[-•*]\s+/, "").replace(/^\d+[\.\)]\s+/, "");

    if (!isBullet && stripped.length < 80 && !stripped.includes("(")) {
      // Likely a section header
      current = { name: stripped, params: [], keep: true };
      aspects.push(current);
    } else {
      // Parameter line
      if (!current) {
        current = { name: "General", params: [], keep: true };
        aspects.push(current);
      }
      current.params.push(inferParam(stripped));
    }
  }

  return aspects;
}

export default function BulkAspectImport({
  onComplete,
  onClose,
}: {
  onComplete: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"paste" | "review" | "saving" | "done">(
    "paste"
  );
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedAspect[]>([]);
  const [saveLog, setSaveLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function doParse() {
    const result = parseText(rawText);
    setParsed(result);
    setStep("review");
  }

  function updateParam(
    ai: number,
    pi: number,
    patch: Partial<ParsedParam>
  ) {
    setParsed((prev) =>
      prev.map((a, i) =>
        i === ai
          ? {
              ...a,
              params: a.params.map((p, j) =>
                j === pi ? { ...p, ...patch } : p
              ),
            }
          : a
      )
    );
  }

  function toggleAspect(ai: number) {
    setParsed((prev) =>
      prev.map((a, i) => (i === ai ? { ...a, keep: !a.keep } : a))
    );
  }

  function toggleParam(ai: number, pi: number) {
    updateParam(ai, pi, {
      keep: !parsed[ai].params[pi].keep,
    });
  }

  async function save() {
    setStep("saving");
    setError(null);
    const log: string[] = [];

    try {
      // 1. Create all unique parameter definitions that don't exist yet.
      const allParams = parsed
        .filter((a) => a.keep)
        .flatMap((a) => a.params.filter((p) => p.keep));
      const uniqueBySlug = new Map<string, ParsedParam>();
      for (const p of allParams) {
        if (!uniqueBySlug.has(p.slug)) uniqueBySlug.set(p.slug, p);
      }

      // Fetch existing param defs to avoid duplicates
      const existingRes = await fetch("/api/parameter-definitions");
      const existingData = await existingRes.json();
      const existing = new Map<string, string>(
        (existingData.parameterDefinitions ?? []).map(
          (pd: { id: string; name: string }) => [pd.name, pd.id]
        )
      );

      const paramIdBySlug = new Map<string, string>();

      for (const [slug, p] of uniqueBySlug) {
        if (existing.has(slug)) {
          paramIdBySlug.set(slug, existing.get(slug)!);
          log.push(`Parameter "${slug}" already exists, reusing.`);
        } else {
          const body: Record<string, unknown> = {
            name: slug,
            dataType: p.dataType,
          };
          if (p.unit) body.unit = p.unit;
          if (p.enumValues.length > 0) {
            body.constraints = { enumValues: p.enumValues };
          }
          const res = await fetch("/api/parameter-definitions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            log.push(`✗ Parameter "${slug}" failed: ${data.error}`);
            continue;
          }
          const id = data.parameterDefinition?.id ?? data.id;
          paramIdBySlug.set(slug, id);
          log.push(`✓ Parameter "${slug}" created.`);
        }
      }

      // 2. Create aspects and link parameters.
      const existingAspectsRes = await fetch("/api/aspects");
      const existingAspectsData = await existingAspectsRes.json();
      const existingAspects = new Map<string, string>(
        (existingAspectsData.aspects ?? []).map(
          (a: { id: string; name: string }) => [a.name, a.id]
        )
      );

      for (const aspect of parsed) {
        if (!aspect.keep) continue;
        let aspectId = existingAspects.get(aspect.name);
        if (aspectId) {
          log.push(`Aspect "${aspect.name}" already exists, reusing.`);
        } else {
          const res = await fetch("/api/aspects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: aspect.name }),
          });
          const data = await res.json();
          if (!res.ok) {
            log.push(`✗ Aspect "${aspect.name}" failed: ${data.error}`);
            continue;
          }
          aspectId = data.aspect?.id ?? data.id;
          log.push(`✓ Aspect "${aspect.name}" created.`);
        }

        // Link parameters
        for (const p of aspect.params) {
          if (!p.keep) continue;
          const pdId = paramIdBySlug.get(p.slug);
          if (!pdId) continue;
          const linkRes = await fetch(`/api/aspects/${aspectId}/parameters`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parameterDefinitionId: pdId }),
          });
          if (linkRes.ok) {
            log.push(`  ✓ Linked "${p.slug}" → "${aspect.name}"`);
          } else {
            const ld = await linkRes.json();
            if (ld.error?.includes("already")) {
              log.push(`  ↳ "${p.slug}" already linked.`);
            } else {
              log.push(`  ✗ Link "${p.slug}" failed: ${ld.error}`);
            }
          }
        }
      }

      setSaveLog(log);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaveLog(log);
      setStep("done");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-700 shrink-0">
          <div className="text-base font-semibold text-slate-100">
            Bulk import aspects + parameters
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Paste a structured list. Section headers become aspects; bulleted
            lines become parameters.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === "paste" && (
            <div className="space-y-3">
              <textarea
                autoFocus
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={18}
                placeholder={`Physical / Package\n- Case size (imperial + metric, e.g., 0603 / 1608)\n- Length, width, height (mm)\n- Termination style (standard, wrap-around, wettable flank)\n\nElectrical — Core\n- Resistance value (ohms)\n- Resistance tolerance (±%, e.g., 0.1%, 1%, 5%)\n- Power rating (W)\n...`}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-accent focus:outline-none"
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              {parsed.map((aspect, ai) => (
                <div
                  key={ai}
                  className={`border rounded ${
                    aspect.keep
                      ? "border-slate-700"
                      : "border-slate-800 opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border-b border-slate-700">
                    <input
                      type="checkbox"
                      checked={aspect.keep}
                      onChange={() => toggleAspect(ai)}
                      className="accent-accent"
                    />
                    <input
                      value={aspect.name}
                      onChange={(e) =>
                        setParsed((prev) =>
                          prev.map((a, i) =>
                            i === ai ? { ...a, name: e.target.value } : a
                          )
                        )
                      }
                      className="flex-1 px-2 py-0.5 bg-transparent border-b border-dashed border-transparent hover:border-slate-600 focus:border-accent text-sm font-semibold text-slate-100 outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      {aspect.params.filter((p) => p.keep).length} params
                    </span>
                  </div>
                  {aspect.keep && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                          <th className="w-8 px-2 py-1" />
                          <th className="text-left px-2 py-1">Name (slug)</th>
                          <th className="text-left px-2 py-1">Type</th>
                          <th className="text-left px-2 py-1">Unit</th>
                          <th className="text-left px-2 py-1">Enum values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aspect.params.map((p, pi) => (
                          <tr
                            key={pi}
                            className={`border-t border-slate-800 ${
                              p.keep ? "" : "opacity-30"
                            }`}
                          >
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={p.keep}
                                onChange={() => toggleParam(ai, pi)}
                                className="accent-accent"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <div className="text-slate-300 text-[11px]">
                                {p.name}
                              </div>
                              <input
                                value={p.slug}
                                onChange={(e) =>
                                  updateParam(ai, pi, {
                                    slug: e.target.value,
                                  })
                                }
                                className="w-full font-mono text-[11px] text-slate-400 bg-transparent border-b border-dashed border-transparent hover:border-slate-600 focus:border-accent outline-none"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={p.dataType}
                                onChange={(e) =>
                                  updateParam(ai, pi, {
                                    dataType: e.target.value,
                                  })
                                }
                                className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300 focus:border-accent focus:outline-none"
                              >
                                <option value="text">text</option>
                                <option value="numeric">numeric</option>
                                <option value="boolean">boolean</option>
                                <option value="enum">enum</option>
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <input
                                value={p.unit ?? ""}
                                onChange={(e) =>
                                  updateParam(ai, pi, {
                                    unit: e.target.value || null,
                                  })
                                }
                                placeholder="—"
                                className="w-16 px-1 py-0.5 bg-transparent border-b border-dashed border-transparent hover:border-slate-600 focus:border-accent text-[11px] text-slate-400 outline-none"
                              />
                            </td>
                            <td className="px-2 py-1">
                              {p.dataType === "enum" ? (
                                <input
                                  value={p.enumValues.join(", ")}
                                  onChange={(e) =>
                                    updateParam(ai, pi, {
                                      enumValues: e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  className="w-full px-1 py-0.5 bg-transparent border-b border-dashed border-transparent hover:border-slate-600 focus:border-accent text-[11px] text-slate-400 outline-none"
                                />
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}

          {(step === "saving" || step === "done") && (
            <div className="space-y-2">
              {step === "saving" && (
                <div className="text-xs text-slate-400">Saving…</div>
              )}
              {error && (
                <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs">
                  {error}
                </div>
              )}
              <div className="bg-slate-900 rounded border border-slate-700 p-3 max-h-80 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-0.5">
                {saveLog.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("✓")
                        ? "text-green-400"
                        : line.startsWith("✗")
                          ? "text-red-400"
                          : ""
                    }
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            {step === "paste" && "Paste text, then Parse."}
            {step === "review" &&
              `${parsed.filter((a) => a.keep).length} aspects, ${parsed
                .filter((a) => a.keep)
                .flatMap((a) => a.params.filter((p) => p.keep)).length} params`}
            {step === "saving" && "Creating…"}
            {step === "done" && "Done."}
          </div>
          <div className="flex items-center gap-2">
            {step === "done" ? (
              <button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                {step === "paste" && (
                  <button
                    onClick={doParse}
                    disabled={!rawText.trim()}
                    className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
                  >
                    Parse
                  </button>
                )}
                {step === "review" && (
                  <>
                    <button
                      onClick={() => setStep("paste")}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={save}
                      className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110"
                    >
                      Save all
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
