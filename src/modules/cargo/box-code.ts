// Karobka harf kodi: har prixod ichida A, B, ... Z, AA, AB, ... ZZ,
// so'ngra yana A ga qaytadi (702 ta kombinatsiyadan keyin sikllanadi).
const CYCLE = 26 + 26 * 26; // 702

export function letterCodeForIndex(zeroBasedIndex: number): string {
  const idx = zeroBasedIndex % CYCLE;
  if (idx < 26) return String.fromCharCode(65 + idx);
  const rem = idx - 26;
  const first = Math.floor(rem / 26);
  const second = rem % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

/** Yorliq/QR matni: GS1-GSR0002-A. */
export function buildBoxCode(
  gsCode: string,
  clientCode: string,
  letter: string,
): string {
  return `${gsCode}-${clientCode}-${letter}`;
}
