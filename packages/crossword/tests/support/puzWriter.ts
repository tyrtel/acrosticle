/** Builds .puz bytes for tests, in the Across Lite layout (checksums left as zero; the reader ignores them). */
export interface PuzOptions {
  readonly width: number;
  readonly height: number;
  /** Row-major answers, `.` for black squares. */
  readonly solution: string;
  readonly title?: string;
  readonly author?: string;
  readonly copyright?: string;
  /** In .puz order: grid order, across before down at each numbered square. */
  readonly clues: readonly string[];
  readonly notes?: string;
  readonly version?: '1.3' | '2.0';
  readonly scrambled?: boolean;
  readonly sections?: readonly { readonly name: string; readonly data: readonly number[] }[];
  /** Claim this many clues instead of the real count. */
  readonly clueCount?: number;
}

export function buildPuz(options: PuzOptions): Uint8Array {
  const bytes: number[] = Array.from({ length: 0x34 }, () => 0);
  const put = (offset: number, text: string) =>
    [...text].forEach((ch, i) => (bytes[offset + i] = ch.charCodeAt(0)));
  put(0x02, 'ACROSS&DOWN\0');
  put(0x18, `${options.version ?? '1.3'}\0`);
  bytes[0x2c] = options.width;
  bytes[0x2d] = options.height;
  const count = options.clueCount ?? options.clues.length;
  bytes[0x2e] = count & 0xff;
  bytes[0x2f] = count >> 8;
  bytes[0x32] = options.scrambled ? 4 : 0;
  for (const ch of options.solution) bytes.push(ch.charCodeAt(0));
  for (const ch of options.solution) bytes.push(ch === '.' ? 0x2e : 0x2d);
  const encode = (text: string) =>
    options.version === '2.0'
      ? [...new TextEncoder().encode(text)]
      : [...text].map((ch) => ch.charCodeAt(0) & 0xff);
  for (const text of [
    options.title ?? '',
    options.author ?? '',
    options.copyright ?? '',
    ...options.clues,
    options.notes ?? '',
  ]) {
    bytes.push(...encode(text), 0);
  }
  for (const section of options.sections ?? []) {
    put(bytes.length, section.name);
    bytes.push(section.data.length & 0xff, section.data.length >> 8, 0, 0, ...section.data, 0);
  }
  return Uint8Array.from(bytes);
}

/** The sample mini's .puz clues, in .puz order. */
export const MINI_PUZ_CLUES = [
  'Fuel at the pump', // 1 Across
  "Laughing ___ (dentist's aid)", // 1 Down
  '___-bodied seaman', // 2 Down
  'Clean ___ (fresh start)', // 3 Down
  'Capable', // 4 Across
  'Mount near Catania', // 5 Down
  'Roofing stone', // 6 Across
  'It hears', // 7 Down
  'Sicilian volcano', // 8 Across
  'Corn unit', // 9 Across
];

export const MINI_SOLUTION = 'GAS..ABLE.SLATE.ETNA..EAR';
