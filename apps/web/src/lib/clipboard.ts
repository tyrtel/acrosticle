/**
 * Copies formatted content: HTML for apps that read it (spreadsheets, documents),
 * with plain text alongside. Falls back to plain text where the browser can't
 * write HTML. Rejects if the browser refuses (e.g. no permission).
 */
export async function copyRich(html: string, text: string): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !('write' in navigator.clipboard)) {
    await navigator.clipboard.writeText(text);
    return;
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ]);
}
