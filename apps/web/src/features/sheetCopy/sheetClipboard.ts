import type { SheetCell, SheetCellKind, SheetLayout, SheetPosition } from './sheetLayout';

/** Narrow enough for one character per column; also suggested to Sheets via <col width>. */
export const COLUMN_WIDTH_PX = 28;
/** Sheets' default row height, written out the way Sheets does so every row keeps it. */
export const ROW_HEIGHT_PX = 21;

/** The sheet as clipboard data: HTML for Google Sheets (and Excel), text for everything else. */
export interface SheetClipboard {
  readonly html: string;
  readonly text: string;
}

// Light colors to match a spreadsheet; the app's highlight green, as in its light theme.
const MARK = '#bfe8c4';
const GRID_BORDER = '1px solid #9a9a9a';

const STYLES: Record<SheetCellKind, string> = {
  empty: '',
  label: `border:${GRID_BORDER};font-size:7pt;color:#555;text-align:center`,
  letter: `border:${GRID_BORDER};font-size:12pt;font-weight:bold;text-align:center`,
  block: `border:${GRID_BORDER};background:#000`,
  punctuation: `border:${GRID_BORDER};font-weight:bold;text-align:center`,
  clue: 'vertical-align:middle;white-space:normal;padding:0 4px',
  answer: 'border-bottom:1px solid #000;font-size:12pt;font-weight:bold;text-align:center',
  number: 'font-size:7pt;color:#666;text-align:center;vertical-align:top',
};

/**
 * Turns a sheet layout into clipboard data. Google Sheets reads pasted HTML
 * tables with their colors, borders and merges, and formulas from the
 * `data-sheets-formula` attribute it writes itself when copying (relative
 * R1C1 references). The plain text is tab-separated, with A1 formulas.
 */
export function sheetClipboard(layout: SheetLayout): SheetClipboard {
  const width = layout.rows[0]?.length ?? 0;
  const columns = `<col width="${COLUMN_WIDTH_PX}">`.repeat(width);
  const body = layout.rows
    .map(
      (row, r) =>
        `<tr style="height:${ROW_HEIGHT_PX}px">${row.map((cell, c) => (cell ? htmlCell(cell, r, c) : '')).join('')}</tr>`,
    )
    .join('');
  const table =
    `<table style="border-collapse:collapse;table-layout:fixed;font-family:Arial,sans-serif;font-size:10pt">` +
    `<colgroup>${columns}</colgroup><tbody>${body}</tbody></table>`;
  // Sheets marks its own clipboard HTML this way; it signals that the data-sheets attributes apply.
  const html = `<google-sheets-html-origin>${table}</google-sheets-html-origin>`;

  const text = layout.rows
    .map((row) => row.map((cell) => (cell ? textCell(cell) : '')).join('\t'))
    .join('\n');
  return { html, text };
}

function htmlCell(cell: SheetCell, row: number, column: number): string {
  const attributes: string[] = [];
  if (cell.columnSpan && cell.columnSpan > 1) attributes.push(`colspan="${cell.columnSpan}"`);
  if (cell.rowSpan && cell.rowSpan > 1) attributes.push(`rowspan="${cell.rowSpan}"`);
  if (cell.copies) {
    const formula = `=R[${cell.copies.row - row}]C[${cell.copies.column - column}]`;
    attributes.push(`data-sheets-formula="${formula}"`);
  }
  const style = [STYLES[cell.kind], cell.marked ? `background:${MARK}` : '']
    .filter(Boolean)
    .join(';');
  if (style) attributes.push(`style="${style}"`);
  const open = attributes.length > 0 ? `<td ${attributes.join(' ')}>` : '<td>';
  return `${open}${escapeHtml(cell.text)}</td>`;
}

function textCell(cell: SheetCell): string {
  if (cell.copies) return `=${a1(cell.copies)}`;
  const text = cell.text.replace(/[\t\r\n]+/g, ' ');
  // Keep typed symbols like "=" or "-" as text instead of starting a formula or number.
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

/** "A1"-style name of a position: columns A..Z, AA..AZ, and so on. */
export function a1({ row, column }: SheetPosition): string {
  let name = '';
  for (let n = column + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return `${name}${row + 1}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
