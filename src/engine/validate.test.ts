import { describe, it, expect } from "vitest";
import { validateConfig } from "./validate";
import { menu } from "../data/menu";

const run = (sel: Record<string, number>) =>
  validateConfig(sel, menu.groups, menu.rules).map((v) => v.code);

describe("validateConfig", () => {
  it("valid config returns no violations", () => {
    expect(run({ toast: 1, fried: 1, sausage: 1 })).toEqual([]);
  });

  it("TC-02: croissant + 3 extras blocked (override wins)", () => {
    expect(
      run({ croissant: 1, sausage: 1, hashbrown: 1, mushroom: 1, beans: 1 }),
    ).toContain("GROUP_MAX");
  });

  it("TC-03: hollandaise with only fried egg blocked", () => {
    expect(run({ toast: 1, fried: 1, sausage: 1, hollandaise: 1 })).toContain("REQUIRES");
  });

  it("TC-04: tofu + beef bacon blocked", () => {
    expect(run({ toast: 1, tofu: 1, bacon: 1 })).toContain("EXCLUDES");
  });

  it("returns ALL violations, not just first", () => {
    const codes = run({ croissant: 1, tofu: 1, bacon: 1, hollandaise: 1, hashbrown: 1, mushroom: 1, beans: 1 });
    expect(codes).toEqual(expect.arrayContaining(["GROUP_MAX", "EXCLUDES", "REQUIRES"]));
  });
});