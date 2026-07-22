import { describe, it, expect } from "vitest";
import { computeLineTotals } from "./dto";

describe("computeLineTotals", () => {
  it("weight = per-box weight × box count", () => {
    const r = computeLineTotals({ productName: "x", boxCount: 30, weightPerBoxKg: 25, totalVolumeM3: 1 });
    expect(r.totalWeightKg).toBe(750);
  });

  it("volume from dimensions: (L×W×H / 1e6) × count, rounded to 4 dp", () => {
    // 35×35×35 = 42875 cm³ = 0.042875 m³ × 30 = 1.28625 → 1.2863
    const r = computeLineTotals({
      productName: "x",
      boxCount: 30,
      boxLengthCm: 35,
      boxWidthCm: 35,
      boxHeightCm: 35,
      weightPerBoxKg: 25,
    });
    expect(r.totalVolumeM3).toBe(1.2863);
  });

  it("falls back to entered totals when dims/per-box are absent", () => {
    const r = computeLineTotals({ productName: "x", boxCount: 10, totalWeightKg: 500, totalVolumeM3: 3.5 });
    expect(r.totalWeightKg).toBe(500);
    expect(r.totalVolumeM3).toBe(3.5);
  });

  it("rounds weight to 3 dp", () => {
    const r = computeLineTotals({ productName: "x", boxCount: 3, weightPerBoxKg: 0.3334, totalVolumeM3: 1 });
    expect(r.totalWeightKg).toBe(1.0);
  });
});
