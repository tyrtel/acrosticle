import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadJson, slugify } from './download';

describe('slugify', () => {
  it.each([
    ['Diplo-Crostic No. 37', 'diplo-crostic-no-37'],
    ['  Hello, World!  ', 'hello-world'],
    ['???', 'puzzle'],
  ])('%j -> %j', (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });
});

describe('downloadJson', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves pretty-printed JSON under the given name', async () => {
    let saved: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadJson('puzzle.json', { a: 1 });

    expect(click).toHaveBeenCalledOnce();
    expect(await saved?.text()).toBe('{\n  "a": 1\n}\n');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
