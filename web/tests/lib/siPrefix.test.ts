import { describe, it, expect } from "vitest";
import { parseSiValue, formatSiValue } from "@/lib/siPrefix";

describe("parseSiValue", () => {
  it("returns plain numbers unchanged", () => {
    expect(parseSiValue("3.14")).toBe(3.14);
    expect(parseSiValue("0")).toBe(0);
    expect(parseSiValue("-42")).toBe(-42);
  });

  it("parses standard ascending prefixes", () => {
    expect(parseSiValue("1k")).toBe(1000);
    expect(parseSiValue("2.2M")).toBeCloseTo(2_200_000, 6);
    expect(parseSiValue("1G")).toBe(1e9);
    expect(parseSiValue("1T")).toBe(1e12);
  });

  it("parses standard descending prefixes", () => {
    expect(parseSiValue("10m")).toBeCloseTo(0.01, 10);
    expect(parseSiValue("470n")).toBeCloseTo(4.7e-7, 15);
    expect(parseSiValue("5p")).toBeCloseTo(5e-12, 20);
  });

  it("treats µ and u as the same prefix (micro)", () => {
    expect(parseSiValue("5µ")).toBeCloseTo(5e-6, 12);
    expect(parseSiValue("5u")).toBeCloseTo(5e-6, 12);
  });

  it("case-sensitive: m=milli, M=mega", () => {
    expect(parseSiValue("1m")).toBeCloseTo(0.001, 10);
    expect(parseSiValue("1M")).toBe(1e6);
  });

  it("tolerates whitespace and negative signs", () => {
    expect(parseSiValue("  4.7 k ")).toBe(4700);
    expect(parseSiValue("-2.5k")).toBe(-2500);
  });

  it("accepts scientific notation", () => {
    expect(parseSiValue("1e3")).toBe(1000);
    expect(parseSiValue("2.5e-3")).toBeCloseTo(0.0025, 10);
  });

  it("returns null on malformed input", () => {
    expect(parseSiValue("")).toBeNull();
    expect(parseSiValue("abc")).toBeNull();
    expect(parseSiValue("1x")).toBeNull();
    expect(parseSiValue("1kk")).toBeNull();
    expect(parseSiValue("k1")).toBeNull();
  });
});

describe("formatSiValue", () => {
  it("formats zero and small numbers", () => {
    expect(formatSiValue(0)).toBe("0");
    expect(formatSiValue(1)).toBe("1");
    expect(formatSiValue(999)).toBe("999");
  });

  it("uses kilo, mega, giga as appropriate", () => {
    expect(formatSiValue(1000)).toBe("1k");
    expect(formatSiValue(4700)).toBe("4.7k");
    expect(formatSiValue(2_200_000)).toBe("2.2M");
    expect(formatSiValue(1.5e9)).toBe("1.5G");
  });

  it("uses milli, micro, nano for sub-unit values", () => {
    expect(formatSiValue(0.001)).toBe("1m");
    expect(formatSiValue(0.0047)).toBe("4.7m");
    expect(formatSiValue(4.7e-7)).toBe("470n");
  });

  it("handles negatives", () => {
    expect(formatSiValue(-1500)).toBe("-1.5k");
  });

  it("round-trips via parseSiValue", () => {
    const xs = [1, 1500, 4700, 4.7e-3, 4.7e-7, 2.2e9, -1.5e6];
    for (const x of xs) {
      const roundtrip = parseSiValue(formatSiValue(x, { sig: 6 }));
      expect(roundtrip).toBeCloseTo(x, 10);
    }
  });
});
