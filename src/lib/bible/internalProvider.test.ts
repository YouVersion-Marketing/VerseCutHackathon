// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { extractVerses } from './internalProvider';

// Mirrors the YouVersion internal chapter HTML: per-verse [data-usfm] spans
// with a .label (verse number) and .content (the words).
const CHAPTER_HTML = `
  <div class="chapter" data-usfm="JHN.3">
    <span class="verse v15" data-usfm="JHN.3.15"><span class="label">15</span><span class="content">that everyone who believes may have eternal life. </span></span>
    <span class="verse v16" data-usfm="JHN.3.16"><span class="label">16</span><span class="content">For God so loved the world </span><span class="content">that he gave his one and only Son. </span></span>
    <span class="verse v17" data-usfm="JHN.3.17"><span class="label">17</span><span class="content">For God did not send his Son to condemn the world. </span></span>
    <span class="verse v18" data-usfm="JHN.3.18"><span class="label">18</span><span class="content">Whoever believes is not condemned. </span></span>
  </div>`;

describe('extractVerses', () => {
  it('extracts a single verse without its label number', () => {
    const t = extractVerses(CHAPTER_HTML, 'JHN', 3, 16, 16);
    expect(t).toBe('For God so loved the world that he gave his one and only Son.');
  });

  it('extracts an inclusive verse range in order', () => {
    const t = extractVerses(CHAPTER_HTML, 'JHN', 3, 16, 17);
    expect(t).toBe(
      'For God so loved the world that he gave his one and only Son. For God did not send his Son to condemn the world.',
    );
  });

  it('returns empty string when verses are absent', () => {
    expect(extractVerses(CHAPTER_HTML, 'JHN', 3, 99, 99)).toBe('');
  });

  it('matches verses merged into a single +-joined data-usfm span', () => {
    const merged = `
      <div class="chapter" data-usfm="GEN.31">
        <span class="verse" data-usfm="GEN.31.1+GEN.31.2"><span class="label">1-2</span><span class="content">Jacob heard the words. </span><span class="content">And Jacob saw Laban's face. </span></span>
        <span class="verse" data-usfm="GEN.31.3"><span class="label">3</span><span class="content">The Lord said to Jacob, return. </span></span>
      </div>`;
    expect(extractVerses(merged, 'GEN', 31, 1, 1)).toBe(
      "Jacob heard the words. And Jacob saw Laban's face.",
    );
    expect(extractVerses(merged, 'GEN', 31, 2, 3)).toBe(
      "Jacob heard the words. And Jacob saw Laban's face. The Lord said to Jacob, return.",
    );
  });

  it('does not double-count nested data-usfm nodes', () => {
    const nested = `
      <div data-usfm="JHN.3.16"><span class="content">outer </span>
        <span data-usfm="JHN.3.16"><span class="content">inner</span></span>
      </div>`;
    // Inner node is skipped because its ancestor already matched.
    expect(extractVerses(nested, 'JHN', 3, 16, 16)).toBe('outer inner');
  });
});
