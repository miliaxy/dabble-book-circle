import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coverSearchText,
  findBookMatch,
  findBookMatchFromCoverText,
  inferSeriesDetails,
  isPossibleIsbn,
  normalizeIsbn,
} from './bookLookup';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('book lookup', () => {
  it('normalizes printed ISBNs and validates their supported lengths', () => {
    expect(normalizeIsbn('978-0-439-02352-8')).toBe('9780439023528');
    expect(normalizeIsbn('0-7432-7356-X')).toBe('074327356X');
    expect(isPossibleIsbn('978-0-439-02352-8')).toBe(true);
    expect(isPossibleIsbn('12345')).toBe(false);
  });

  it('turns noisy OCR lines into a bounded book-search query', () => {
    expect(coverSearchText('  THE WILD ROBOT !!\nPeter Brown\n\n@@ ')).toBe('THE WILD ROBOT Peter Brown');
  });

  it('prefills series only when metadata contains an explicit series marker', () => {
    expect(inferSeriesDetails('The Bad Guys', 'Episode 2')).toEqual({
      seriesName: 'The Bad Guys',
      seriesNumber: '2',
    });
    expect(inferSeriesDetails('Dog Man # 3')).toEqual({
      seriesName: 'Dog Man',
      seriesNumber: '3',
    });
    expect(inferSeriesDetails('Matilda')).toEqual({});
  });

  it('finds book details using an ISBN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        volumeInfo: {
          title: 'The Wild Robot',
          authors: ['Peter Brown'],
          description: '<p>A robot on an island.</p>',
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780316381994' }],
        },
      }],
    }), { status: 200 })));

    await expect(findBookMatch({ title: '', author: '', isbn: '978-0-316-38199-4' })).resolves.toEqual({
      title: 'The Wild Robot',
      author: 'Peter Brown',
      description: 'A robot on an island.',
      isbn: '9780316381994',
    });
  });

  it('selects the title that overlaps most with cover text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [
        { volumeInfo: { title: 'Robot Dreams', authors: ['Sara Varon'] } },
        { volumeInfo: { title: 'The Wild Robot', authors: ['Peter Brown'] } },
      ],
    }), { status: 200 })));

    const match = await findBookMatchFromCoverText('THE WILD ROBOT\nPETER BROWN');
    expect(match?.title).toBe('The Wild Robot');
    expect(match?.author).toBe('Peter Brown');
  });
});
