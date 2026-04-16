"use client";

import { useMemo, useState } from "react";
import { parseSiValue } from "@/lib/siPrefix";

interface ExistingDef {
  id: string;
  name: string;
  dataType: string;
  unit: string | null;
  description: string | null;
  constraints: {
    enumValues?: string[];
    min?: number;
    max?: number;
  } | null;
}

interface ParsedParam {
  name: string;
  slug: string;
  dataType: string;
  unit: string | null;
  description: string;
  searchTerms: string[];
  min: number | null;
  max: number | null;
  enumValues: string[];
  keep: boolean;
  // Conflict detection is populated after parse.
  conflictWith?: ExistingDef;
  resolution?: "reuse" | "rename" | "skip";
  renameTo?: string;
}

interface ParsedAspect {
  name: string;
  params: ParsedParam[];
  keep: boolean;
}

const PROMPT_PREAMBLE = `You are generating an aspect schema for WhereTF, a workshop item
tracker. Aspects are reusable groups of parameters that describe one
facet of a physical item (e.g. "Electrical Ratings", "Physical Package").
Parameters are atomic typed properties — name, dataType, optional unit
or enum values. Users apply aspects to items; the aspect decides which
parameters get prompted for.

Emit ONLY valid JSON matching this exact shape — no prose, no markdown
fences, no trailing commentary:

{
  "aspects": [
    {
      "name": "<section name, e.g. Physical / Package>",
      "params": [
        {
          "slug": "<lowercase_snake_case>",
          "name": "<human readable>",
          "dataType": "text" | "numeric" | "boolean" | "enum",
          "unit": "<unit e.g. ohm, mm, W>" | null,
          "description": "<one sentence, <=120 chars, plain language>",
          "searchTerms": ["alias", "synonym", "abbrev"],
          "min": <number> | null,
          "max": <number> | null,
          "enumValues": ["a", "b"]
        }
      ]
    }
  ]
}

Rules:
- slug is lowercase snake_case derived from name; unique within the
  whole document.
- dataType = numeric when the property has a unit, range, or scalar
  measurement; enum when a finite list of values is typical; boolean
  when yes/no; else text.
- unit is null unless dataType is numeric.
- description: always a non-empty sentence answering "what does this
  parameter describe?" (not "what value does it hold"). Keep to
  ~120 characters. Plain language, no jargon unless necessary.
- searchTerms: 2-5 common aliases, abbreviations, or unit synonyms
  users might type when searching. Lowercase. Empty array allowed
  but discouraged.
- min / max: emit a number only when dataType is numeric AND a
  meaningful physical bound exists (e.g. tolerance % is 0..100; duty
  cycle is 0..100; resistance has no useful upper bound so both stay
  null). Otherwise null. Never emit negative values for strictly-
  positive quantities.
- enumValues is [] unless dataType is enum.
- Group parameters into aspects the way a domain expert would — one
  aspect per coherent facet (physical, electrical-core, reliability,
  marking, etc.). Expect roughly 4–10 aspects for a well-specified
  component.
- Include only parameters a typical user would want to record. Skip
  obscure or manufacturer-specific fields unless the item type
  inherently demands them.

Item type to generate aspects for:`;

const JSON_PLACEHOLDER = `{
  "aspects": [
    {
      "name": "Physical / Package",
      "params": [
        {
          "slug": "case_size",
          "name": "Case size",
          "dataType": "text",
          "unit": null,
          "description": "Imperial/metric package size code",
          "searchTerms": ["package", "footprint", "size"],
          "min": null,
          "max": null,
          "enumValues": []
        }
      ]
    }
  ]
}`;

type RawParam = {
  slug?: unknown;
  name?: unknown;
  dataType?: unknown;
  unit?: unknown;
  description?: unknown;
  searchTerms?: unknown;
  min?: unknown;
  max?: unknown;
  enumValues?: unknown;
};
type RawAspect = { name?: unknown; params?: unknown };

function validateAndNormalize(raw: unknown): ParsedAspect[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Root must be an object");
  }
  const top = raw as { aspects?: unknown };
  if (!Array.isArray(top.aspects)) {
    throw new Error("aspects: expected an array");
  }
  const VALID_TYPES = new Set(["text", "numeric", "boolean", "enum"]);
  const seenSlugs = new Set<string>();
  const out: ParsedAspect[] = [];

  top.aspects.forEach((a: unknown, ai) => {
    const ar = a as RawAspect;
    if (!ar || typeof ar !== "object") {
      throw new Error(`aspects[${ai}]: expected an object`);
    }
    if (typeof ar.name !== "string" || !ar.name.trim()) {
      throw new Error(`aspects[${ai}].name: expected non-empty string`);
    }
    if (!Array.isArray(ar.params)) {
      throw new Error(`aspects[${ai}].params: expected an array`);
    }
    const params: ParsedParam[] = [];
    ar.params.forEach((p: unknown, pi) => {
      const pr = p as RawParam;
      if (!pr || typeof pr !== "object") {
        throw new Error(
          `aspects[${ai}].params[${pi}]: expected an object`
        );
      }
      if (typeof pr.slug !== "string" || !pr.slug.trim()) {
        throw new Error(
          `aspects[${ai}].params[${pi}].slug: expected non-empty string`
        );
      }
      if (typeof pr.name !== "string" || !pr.name.trim()) {
        throw new Error(
          `aspects[${ai}].params[${pi}].name: expected non-empty string`
        );
      }
      if (
        typeof pr.dataType !== "string" ||
        !VALID_TYPES.has(pr.dataType)
      ) {
        throw new Error(
          `aspects[${ai}].params[${pi}].dataType: expected one of text|numeric|boolean|enum, got ${JSON.stringify(pr.dataType)}`
        );
      }
      const unit =
        pr.unit === undefined || pr.unit === null
          ? null
          : typeof pr.unit === "string"
            ? pr.unit.trim() || null
            : (() => {
                throw new Error(
                  `aspects[${ai}].params[${pi}].unit: expected string or null`
                );
              })();
      const coerceNum = (v: unknown, field: string): number | null => {
        if (v === undefined || v === null) return null;
        if (typeof v !== "number" || !Number.isFinite(v)) {
          throw new Error(
            `aspects[${ai}].params[${pi}].${field}: expected a finite number or null`
          );
        }
        return v;
      };
      let min = coerceNum(pr.min, "min");
      let max = coerceNum(pr.max, "max");
      if (pr.dataType !== "numeric") {
        // Coerce away — only numeric carries bounds.
        min = null;
        max = null;
      }
      let enumValues: string[] = [];
      if (pr.enumValues !== undefined && pr.enumValues !== null) {
        if (!Array.isArray(pr.enumValues)) {
          throw new Error(
            `aspects[${ai}].params[${pi}].enumValues: expected array`
          );
        }
        enumValues = pr.enumValues.map((v: unknown, ei: number) => {
          if (typeof v !== "string") {
            throw new Error(
              `aspects[${ai}].params[${pi}].enumValues[${ei}]: expected string`
            );
          }
          return v;
        });
      }
      if (seenSlugs.has(pr.slug)) {
        // duplicate is allowed (save-path dedup); no hard error.
      }
      seenSlugs.add(pr.slug);

      // description
      let description = "";
      if (pr.description !== undefined && pr.description !== null) {
        if (typeof pr.description !== "string") {
          throw new Error(
            `aspects[${ai}].params[${pi}].description: expected string or null`
          );
        }
        description = pr.description.trim();
      }

      // searchTerms
      let searchTerms: string[] = [];
      if (pr.searchTerms !== undefined && pr.searchTerms !== null) {
        if (!Array.isArray(pr.searchTerms)) {
          throw new Error(
            `aspects[${ai}].params[${pi}].searchTerms: expected array of strings`
          );
        }
        searchTerms = pr.searchTerms.map((v: unknown, ti: number) => {
          if (typeof v !== "string") {
            throw new Error(
              `aspects[${ai}].params[${pi}].searchTerms[${ti}]: expected string`
            );
          }
          return v.trim();
        }).filter(Boolean);
      }

      params.push({
        slug: pr.slug,
        name: pr.name,
        dataType: pr.dataType,
        unit,
        description,
        searchTerms,
        min,
        max,
        enumValues,
        keep: true,
      });
    });
    out.push({ name: ar.name, params, keep: true });
  });

  return out;
}

export default function BulkAspectImport({
  onComplete,
  onClose,
}: {
  onComplete: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<
    "extract" | "ingest" | "review" | "saving" | "done"
  >("extract");
  const [itemTypeInput, setItemTypeInput] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [parsed, setParsed] = useState<ParsedAspect[]>([]);
  const [saveLog, setSaveLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fullPrompt = useMemo(
    () =>
      itemTypeInput.trim()
        ? `${PROMPT_PREAMBLE} ${itemTypeInput.trim()}`
        : PROMPT_PREAMBLE,
    [itemTypeInput]
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable in some browsers/contexts.
    }
  }

  async function parseJson() {
    setValidationError(null);
    try {
      const data = JSON.parse(jsonText);
      const normalized = validateAndNormalize(data);

      // Detect conflicts against existing parameter definitions.
      const res = await fetch("/api/parameter-definitions");
      const body = await res.json();
      const byName = new Map<string, ExistingDef>(
        (body.parameterDefinitions ?? []).map(
          (d: ExistingDef) => [d.name, d] as const
        )
      );
      const withConflicts = normalized.map((a) => ({
        ...a,
        params: a.params.map((p) => {
          const existing = byName.get(p.slug);
          if (existing) {
            return {
              ...p,
              conflictWith: existing,
              resolution: "reuse" as const,
            };
          }
          return p;
        }),
      }));
      setParsed(withConflicts);
      setStep("review");
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Invalid JSON"
      );
    }
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

  // Find conflict params across all aspects (index pairs for in-place editing).
  const conflicts: Array<{ ai: number; pi: number; param: ParsedParam }> = [];
  for (let ai = 0; ai < parsed.length; ai++) {
    for (let pi = 0; pi < parsed[ai].params.length; pi++) {
      const p = parsed[ai].params[pi];
      if (p.conflictWith) conflicts.push({ ai, pi, param: p });
    }
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
      // Resolve effective slug per conflict resolution. Renames get the
      // renameTo value; reuse and non-conflict rows keep their slug.
      const resolvedParams = parsed
        .filter((a) => a.keep)
        .flatMap((a) => a.params.filter((p) => p.keep))
        .map((p) => {
          if (p.conflictWith && p.resolution === "rename" && p.renameTo) {
            return { ...p, slug: p.renameTo.trim() };
          }
          return p;
        });
      const uniqueBySlug = new Map<string, ParsedParam>();
      for (const p of resolvedParams) {
        if (!uniqueBySlug.has(p.slug)) uniqueBySlug.set(p.slug, p);
      }

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
          if (p.description) body.description = p.description;
          if (p.searchTerms.length > 0) body.searchTerms = p.searchTerms;
          const constraints: Record<string, unknown> = {};
          if (p.enumValues.length > 0) constraints.enumValues = p.enumValues;
          if (p.dataType === "numeric") {
            if (typeof p.min === "number") constraints.min = p.min;
            if (typeof p.max === "number") constraints.max = p.max;
          }
          if (Object.keys(constraints).length > 0) {
            body.constraints = constraints;
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

        for (const p of aspect.params) {
          if (!p.keep) continue;
          // Effective slug follows conflict resolution (rename).
          const effectiveSlug =
            p.conflictWith && p.resolution === "rename" && p.renameTo
              ? p.renameTo.trim()
              : p.slug;
          const pdId = paramIdBySlug.get(effectiveSlug);
          if (!pdId) continue;
          const linkRes = await fetch(`/api/aspects/${aspectId}/parameters`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parameterDefinitionId: pdId }),
          });
          if (linkRes.ok) {
            log.push(`  ✓ Linked "${effectiveSlug}" → "${aspect.name}"`);
          } else {
            const ld = await linkRes.json();
            if (ld.error?.includes("already")) {
              log.push(`  ↳ "${effectiveSlug}" already linked.`);
            } else {
              log.push(`  ✗ Link "${effectiveSlug}" failed: ${ld.error}`);
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
            {step === "extract" &&
              "Generate a prompt, paste it into an AI, return with JSON."}
            {step === "ingest" && "Paste the JSON the AI returned."}
            {step === "review" &&
              "Review the aspects and parameters before saving."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === "extract" && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">
                  Item type
                </span>
                <input
                  autoFocus
                  value={itemTypeInput}
                  onChange={(e) => setItemTypeInput(e.target.value)}
                  placeholder="e.g. MLCC capacitors, hex socket cap screws, SMD tactile switches"
                  className="mt-1 w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 focus:border-accent focus:outline-none"
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">
                    Prompt preview
                  </span>
                  <button
                    onClick={copyPrompt}
                    className="text-[11px] px-2 py-0.5 bg-accent text-white rounded hover:brightness-110"
                  >
                    {copied ? "Copied ✓" : "Copy prompt"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={fullPrompt}
                  rows={16}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-[11px] text-slate-400 font-mono focus:outline-none"
                />
              </div>
            </div>
          )}

          {step === "ingest" && (
            <div className="space-y-3">
              {validationError && (
                <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs font-mono">
                  {validationError}
                </div>
              )}
              <textarea
                autoFocus
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={18}
                placeholder={JSON_PLACEHOLDER}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-accent focus:outline-none"
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              {conflicts.length > 0 && (
                <div className="border border-amber-700/50 bg-amber-900/10 rounded">
                  <div className="px-3 py-2 border-b border-amber-700/40 flex items-center justify-between">
                    <div className="text-xs font-semibold text-amber-200">
                      {conflicts.length} parameter
                      {conflicts.length === 1 ? "" : "s"} already exist
                    </div>
                    <div className="text-[10px] text-amber-300/70">
                      Resolve each before saving
                    </div>
                  </div>
                  <div className="divide-y divide-amber-700/30">
                    {conflicts.map(({ ai, pi, param }) => {
                      const existing = param.conflictWith!;
                      const resolution = param.resolution ?? "reuse";
                      const existingC = (existing.constraints ?? {}) as {
                        enumValues?: string[];
                        min?: number;
                        max?: number;
                      };
                      const existingSummary = [
                        existing.dataType,
                        existing.unit ?? null,
                        existingC.enumValues?.length
                          ? existingC.enumValues.join(", ")
                          : existingC.min !== undefined ||
                              existingC.max !== undefined
                            ? `${existingC.min ?? "…"}…${existingC.max ?? "…"}`
                            : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const incomingSummary = [
                        param.dataType,
                        param.unit,
                        param.enumValues.length
                          ? param.enumValues.join(", ")
                          : param.min !== null || param.max !== null
                            ? `${param.min ?? "…"}…${param.max ?? "…"}`
                            : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <div
                          key={`${ai}:${pi}`}
                          className="px-3 py-2 space-y-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-amber-100">
                              {param.slug}
                            </span>
                            <span className="text-[10px] text-amber-300/60">
                              in "{parsed[ai].name}"
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-[11px]">
                            <div>
                              <div className="text-amber-300/60">
                                Existing
                              </div>
                              <div className="text-slate-300">
                                {existingSummary || "—"}
                              </div>
                              {existing.description && (
                                <div className="text-slate-500 italic mt-0.5">
                                  {existing.description}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-amber-300/60">Incoming</div>
                              <div className="text-slate-300">
                                {incomingSummary || "—"}
                              </div>
                              {param.description && (
                                <div className="text-slate-500 italic mt-0.5">
                                  {param.description}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[11px]">
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`resolution-${ai}-${pi}`}
                                checked={resolution === "reuse"}
                                onChange={() =>
                                  updateParam(ai, pi, {
                                    resolution: "reuse",
                                    renameTo: undefined,
                                    keep: true,
                                  })
                                }
                                className="accent-accent"
                              />
                              <span className="text-slate-200">
                                Reuse existing
                              </span>
                            </label>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`resolution-${ai}-${pi}`}
                                checked={resolution === "rename"}
                                onChange={() =>
                                  updateParam(ai, pi, {
                                    resolution: "rename",
                                    renameTo:
                                      param.renameTo ?? `${param.slug}_2`,
                                    keep: true,
                                  })
                                }
                                className="accent-accent"
                              />
                              <span className="text-slate-200">Rename</span>
                            </label>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`resolution-${ai}-${pi}`}
                                checked={resolution === "skip"}
                                onChange={() =>
                                  updateParam(ai, pi, {
                                    resolution: "skip",
                                    renameTo: undefined,
                                    keep: false,
                                  })
                                }
                                className="accent-accent"
                              />
                              <span className="text-slate-200">Skip</span>
                            </label>
                            {resolution === "rename" && (
                              <input
                                value={param.renameTo ?? ""}
                                onChange={(e) =>
                                  updateParam(ai, pi, {
                                    renameTo: e.target.value,
                                  })
                                }
                                placeholder="new_slug"
                                className="flex-1 max-w-xs px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 focus:border-accent focus:outline-none"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                          <th className="text-left px-2 py-1">Min / Max</th>
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
                              <div className="flex items-center gap-1.5">
                                <div className="text-slate-300 text-[11px]">
                                  {p.name}
                                </div>
                                {p.conflictWith && (
                                  <span
                                    className={`text-[9px] px-1 py-px rounded ${
                                      p.resolution === "skip"
                                        ? "bg-slate-700 text-slate-400"
                                        : p.resolution === "rename"
                                          ? "bg-blue-900/50 text-blue-300"
                                          : "bg-amber-900/50 text-amber-300"
                                    }`}
                                    title="See Conflicts section above"
                                  >
                                    {p.resolution === "skip"
                                      ? "skipped"
                                      : p.resolution === "rename"
                                        ? `→ ${p.renameTo || "…"}`
                                        : "reusing"}
                                  </span>
                                )}
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
                              {p.description && (
                                <div
                                  className="text-[10px] text-slate-500 italic mt-0.5 truncate"
                                  title={p.description}
                                >
                                  {p.description}
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={p.dataType}
                                onChange={(e) => {
                                  const nextType = e.target.value;
                                  const patch: Partial<ParsedParam> = {
                                    dataType: nextType,
                                  };
                                  // Strip bounds when leaving numeric.
                                  if (nextType !== "numeric") {
                                    patch.min = null;
                                    patch.max = null;
                                  }
                                  updateParam(ai, pi, patch);
                                }}
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
                              {p.dataType === "numeric" ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    value={p.min ?? ""}
                                    onChange={(e) => {
                                      const raw = e.target.value.trim();
                                      if (raw === "") {
                                        updateParam(ai, pi, { min: null });
                                      } else {
                                        const n = parseSiValue(raw);
                                        if (n !== null)
                                          updateParam(ai, pi, { min: n });
                                      }
                                    }}
                                    placeholder="min"
                                    className="w-14 px-1 py-0.5 bg-transparent border-b border-dashed border-transparent hover:border-slate-600 focus:border-accent text-[11px] text-slate-400 outline-none tabular-nums"
                                  />
                                  <span className="text-slate-700">…</span>
                                  <input
                                    value={p.max ?? ""}
                                    onChange={(e) => {
                                      const raw = e.target.value.trim();
                                      if (raw === "") {
                                        updateParam(ai, pi, { max: null });
                                      } else {
                                        const n = parseSiValue(raw);
                                        if (n !== null)
                                          updateParam(ai, pi, { max: n });
                                      }
                                    }}
                                    placeholder="max"
                                    className="w-14 px-1 py-0.5 bg-transparent border-b border-dashed border-transparent hover:border-slate-600 focus:border-accent text-[11px] text-slate-400 outline-none tabular-nums"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
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
            {step === "extract" &&
              (itemTypeInput.trim()
                ? "Copy the prompt, run it through an AI, continue with the JSON."
                : "Enter an item type to build the prompt.")}
            {step === "ingest" && "Paste JSON, then Parse JSON."}
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
                {step === "extract" && (
                  <button
                    onClick={() => setStep("ingest")}
                    className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110"
                  >
                    I have JSON →
                  </button>
                )}
                {step === "ingest" && (
                  <>
                    <button
                      onClick={() => setStep("extract")}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={parseJson}
                      disabled={!jsonText.trim()}
                      className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
                    >
                      Parse JSON
                    </button>
                  </>
                )}
                {step === "review" && (
                  <>
                    <button
                      onClick={() => setStep("ingest")}
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
