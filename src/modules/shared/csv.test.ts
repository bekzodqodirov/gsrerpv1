import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

const BOM = "﻿";

describe("toCsv", () => {
  it("prepends a UTF-8 BOM and uses CRLF line endings", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}a,b\r\n1,2`);
  });

  it("quotes fields containing comma, quote, semicolon or newline", () => {
    const csv = toCsv(["x"], [["a,b"], ['he said "hi"'], ["line1\nline2"], ["a;b"]]);
    const lines = csv.slice(BOM.length).split("\r\n");
    expect(lines[1]).toBe('"a,b"');
    expect(lines[2]).toBe('"he said ""hi"""');
    expect(lines[3]).toBe('"line1\nline2"');
    expect(lines[4]).toBe('"a;b"');
  });

  it("renders null/empty as blank and leaves plain values unquoted", () => {
    const csv = toCsv(["x", "y"], [[null, "ok"]]);
    expect(csv.slice(BOM.length)).toBe("x,y\r\n,ok");
  });
});
