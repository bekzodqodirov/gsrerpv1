import { describe, it, expect } from "vitest";
import { legStatuses, sourceStatusForOrigin } from "./dto";

describe("legStatuses (cargo status transitions per leg)", () => {
  it("China → Kashgar (consolidation): in_transit_ksg → at_kashgar", () => {
    expect(legStatuses("CN", "consolidation")).toEqual({
      inTransit: "in_transit_ksg",
      arrived: "at_kashgar",
    });
  });

  it("→ Uzbekistan (any UZ warehouse): in_transit_uz → at_uz_warehouse", () => {
    expect(legStatuses("UZ", "customs")).toEqual({
      inTransit: "in_transit_uz",
      arrived: "at_uz_warehouse",
    });
    // country wins over kind
    expect(legStatuses("UZ", "consolidation").arrived).toBe("at_uz_warehouse");
  });

  it("other China receiving destinations behave like the Kashgar leg", () => {
    expect(legStatuses("CN", "receiving").arrived).toBe("at_kashgar");
  });
});

describe("sourceStatusForOrigin", () => {
  it("consolidation warehouse ships at_kashgar cargo", () => {
    expect(sourceStatusForOrigin("consolidation")).toBe("at_kashgar");
  });
  it("receiving warehouse ships received_cn cargo", () => {
    expect(sourceStatusForOrigin("receiving")).toBe("received_cn");
  });
});
