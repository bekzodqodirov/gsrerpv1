import { describe, it, expect } from "vitest";
import { ageBucket, daysSince } from "./dto";

const DAY = 86_400_000;

describe("daysSince", () => {
  it("counts whole days since a date", () => {
    const now = 1_000_000_000_000;
    expect(daysSince(new Date(now - 5 * DAY), now)).toBe(5);
    expect(daysSince(new Date(now - 5 * DAY - 1000), now)).toBe(5);
  });

  it("never returns negative for a future date", () => {
    const now = 1_000_000_000_000;
    expect(daysSince(new Date(now + 3 * DAY), now)).toBe(0);
  });
});

describe("ageBucket boundaries", () => {
  it("0–7 → fresh", () => {
    expect(ageBucket(0)).toBe("fresh");
    expect(ageBucket(7)).toBe("fresh");
  });
  it("8–15 → warn", () => {
    expect(ageBucket(8)).toBe("warn");
    expect(ageBucket(15)).toBe("warn");
  });
  it("16–30 → old", () => {
    expect(ageBucket(16)).toBe("old");
    expect(ageBucket(30)).toBe("old");
  });
  it("31+ → critical", () => {
    expect(ageBucket(31)).toBe("critical");
    expect(ageBucket(365)).toBe("critical");
  });
});
