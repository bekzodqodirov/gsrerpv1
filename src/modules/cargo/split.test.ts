import { describe, it, expect } from "vitest";
import { computeSplitTotals, remainderRegNumber } from "./split";

describe("computeSplitTotals (qoldiq prixod hisobi)", () => {
  it("karobka og'irligi ma'lum bo'lsa — aniq hisob", () => {
    // 50 karobka × 12kg = 600kg; 20 tasi qoladi
    const r = computeSplitTotals(
      { boxCount: 50, totalWeightKg: 600, totalVolumeM3: 2.5, weightPerBoxKg: 12 },
      20,
    );
    expect(r.child.weightKg).toBe(240);
    expect(r.parent.weightKg).toBe(360);
    expect(r.child.volumeM3).toBe(1);
    expect(r.parent.volumeM3).toBe(1.5);
  });

  it("karobka og'irligi noma'lum bo'lsa — proporsional", () => {
    const r = computeSplitTotals(
      { boxCount: 3, totalWeightKg: 100, totalVolumeM3: 1 },
      1,
    );
    expect(r.child.weightKg).toBe(33.333);
    expect(r.parent.weightKg).toBe(66.667);
  });

  it("ota + bola = asl jami (yaxlitlashda yo'qotish yo'q)", () => {
    const line = { boxCount: 7, totalWeightKg: 123.457, totalVolumeM3: 0.7777 };
    for (let move = 1; move < 7; move++) {
      const r = computeSplitTotals(line, move);
      expect(r.child.weightKg + r.parent.weightKg).toBeCloseTo(123.457, 3);
      expect(r.child.volumeM3 + r.parent.volumeM3).toBeCloseTo(0.7777, 4);
    }
  });

  it("0 yoki hammasini ko'chirish — xato", () => {
    const line = { boxCount: 5, totalWeightKg: 50, totalVolumeM3: 1 };
    expect(() => computeSplitTotals(line, 0)).toThrow("SPLIT_BAD_COUNT");
    expect(() => computeSplitTotals(line, 5)).toThrow("SPLIT_BAD_COUNT");
  });
});

describe("remainderRegNumber", () => {
  it("asl regga -R{n} qo'shadi", () => {
    expect(remainderRegNumber("YK-2026-00011", 1)).toBe("YK-2026-00011-R1");
    expect(remainderRegNumber("YK-2026-00011", 3)).toBe("YK-2026-00011-R3");
  });
});
