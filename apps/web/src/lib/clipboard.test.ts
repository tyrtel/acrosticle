import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyRich } from './clipboard';

class FakeClipboardItem {
  constructor(readonly items: Record<string, Blob>) {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyRich', () => {
  it('writes HTML and plain text together', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } });

    await copyRich('<b>A</b>', 'A');

    const [[[item]]] = write.mock.calls as [[[FakeClipboardItem]]];
    expect(Object.keys(item.items)).toEqual(['text/html', 'text/plain']);
    expect(await item.items['text/html']?.text()).toBe('<b>A</b>');
    expect(await item.items['text/plain']?.text()).toBe('A');
  });

  it('falls back to plain text where HTML is not supported', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copyRich('<b>A</b>', 'A');
    expect(writeText).toHaveBeenCalledWith('A');
  });

  it('passes on a refusal', async () => {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    vi.stubGlobal('navigator', {
      clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    await expect(copyRich('<b>A</b>', 'A')).rejects.toThrow('denied');
  });
});
