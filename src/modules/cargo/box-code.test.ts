import { describe, it, expect } from "vitest";
import {
  letterCodeForIndex,
  buildBoxCode,
  buildBoxQr,
  nextLetterSeqs,
} from "./box-code";

describe("letterCodeForIndex", () => {
  it("maps single letters A..Z", () => {
    expect(letterCodeForIndex(0)).toBe("A");
    expect(letterCodeForIndex(25)).toBe("Z");
  });

  it("maps double letters AA..ZZ", () => {
    expect(letterCodeForIndex(26)).toBe("AA");
    expect(letterCodeForIndex(27)).toBe("AB");
    expect(letterCodeForIndex(51)).toBe("AZ");
    expect(letterCodeForIndex(52)).toBe("BA");
    expect(letterCodeForIndex(701)).toBe("ZZ");
  });

  it("cycles back to A after 702 combinations", () => {
    expect(letterCodeForIndex(702)).toBe("A");
    expect(letterCodeForIndex(703)).toBe("B");
  });

  it("produces 702 distinct codes across one cycle", () => {
    const set = new Set(Array.from({ length: 702 }, (_, i) => letterCodeForIndex(i)));
    expect(set.size).toBe(702);
  });
});

describe("nextLetterSeqs (per-client continuing letters)", () => {
  it("first receipt of a client starts at A, B", () => {
    const { seqs, newLast } = nextLetterSeqs(0, 2);
    expect(seqs.map(letterCodeForIndex)).toEqual(["A", "B"]);
    expect(newLast).toBe(2);
  });

  it("next receipt CONTINUES (C, D) instead of restarting", () => {
    // Mijozning oldingi prixodidan keyin lastSeq = 2.
    const { seqs, newLast } = nextLetterSeqs(2, 2);
    expect(seqs.map(letterCodeForIndex)).toEqual(["C", "D"]);
    expect(newLast).toBe(4);
  });

  it("keeps continuing across many receipts (E, F, G)", () => {
    expect(nextLetterSeqs(4, 3).seqs.map(letterCodeForIndex)).toEqual([
      "E",
      "F",
      "G",
    ]);
  });

  it("resets to A after ZZ (701)", () => {
    // 700 dan boshlab 3 ta: ZY, ZZ, keyin A ga qaytadi.
    expect(nextLetterSeqs(700, 3).seqs.map(letterCodeForIndex)).toEqual([
      "ZY",
      "ZZ",
      "A",
    ]);
  });

  it("reuses existing seqs on edit (no shift), then continues", () => {
    // Tahrir: 2 eski (0,1) + 1 yangi -> A, B, keyin C (lastSeq=2 dan).
    const { seqs, newLast } = nextLetterSeqs(2, 3, [0, 1]);
    expect(seqs.map(letterCodeForIndex)).toEqual(["A", "B", "C"]);
    expect(newLast).toBe(3); // faqat 1 ta yangi harf ajratildi
  });
});

describe("buildBoxCode (human product mark)", () => {
  it("joins warehouse, client and letter", () => {
    expect(buildBoxCode("GS1", "GSR-0002", "A")).toBe("GS1-GSR-0002-A");
  });
});

describe("buildBoxQr (unique per-box scan code)", () => {
  it("formats reg number + zero-padded box number", () => {
    expect(buildBoxQr("YK-2026-00006", 37)).toBe("YK-2026-00006-B037");
    expect(buildBoxQr("YK-2026-00006", 1)).toBe("YK-2026-00006-B001");
    expect(buildBoxQr("YK-2026-00006", 999)).toBe("YK-2026-00006-B999");
  });

  it("is unique for every box in a cargo", () => {
    const codes = Array.from({ length: 250 }, (_, i) => buildBoxQr("YK-2026-00042", i + 1));
    expect(new Set(codes).size).toBe(250);
  });

  it("never collides across different cargos", () => {
    expect(buildBoxQr("YK-2026-00001", 5)).not.toBe(buildBoxQr("YK-2026-00002", 5));
  });
});
