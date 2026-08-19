interface GoogleBookVolume {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
}

interface OpenLibraryBook {
  title?: string;
  authors?: Array<{ name?: string }>;
  notes?: string | { value?: string };
  series?: string | string[];
}

export interface BookMatch {
  title: string;
  author: string;
  description: string;
  isbn?: string;
  seriesName?: string;
  seriesNumber?: string;
}

export function normalizeIsbn(value: string) {
  return value.replace(/[^0-9X]/gi, '').toUpperCase();
}

export function isPossibleIsbn(value: string) {
  const normalized = normalizeIsbn(value);
  return normalized.length === 10 || normalized.length === 13;
}

function descriptionText(value: OpenLibraryBook['notes']) {
  if (typeof value === 'string') return value;
  return value?.value ?? '';
}

export function inferSeriesDetails(title: string, subtitle = '') {
  const candidates = [title, subtitle ? `${title}: ${subtitle}` : ''].filter(Boolean);
  for (const candidate of candidates) {
    const explicitNumber = candidate.match(/^(.+?)(?:\s*[:;,–—-]\s*|\s+)(?:book|volume|vol\.?|episode|part)\s*#?\s*(\d+(?:\.\d+)?)(?:\b|$)/i)
      ?? candidate.match(/^(.+?)\s+#\s*(\d+(?:\.\d+)?)(?:\b|$)/i);
    if (explicitNumber?.[1] && explicitNumber[2]) {
      return { seriesName: explicitNumber[1].trim(), seriesNumber: explicitNumber[2] };
    }
  }
  return {};
}

function googleMatch(volume: GoogleBookVolume, fallbackAuthor = ''): BookMatch | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;
  const matchedIsbn = info.industryIdentifiers?.find((identifier) => identifier.type === 'ISBN_13')?.identifier
    ?? info.industryIdentifiers?.find((identifier) => identifier.type === 'ISBN_10')?.identifier;
  const series = inferSeriesDetails(info.title, info.subtitle);
  return {
    title: info.title,
    author: info.authors?.join(', ') ?? fallbackAuthor,
    description: info.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '',
    isbn: matchedIsbn,
    ...series,
  };
}

async function googleBooks(query: string, maxResults = 5) {
  const endpoint = new URL('https://www.googleapis.com/books/v1/volumes');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('maxResults', String(maxResults));
  endpoint.searchParams.set('printType', 'books');
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Google Books lookup failed');
  const payload = (await response.json()) as { items?: GoogleBookVolume[] };
  return payload.items ?? [];
}

async function openLibraryIsbn(isbn: string): Promise<BookMatch | null> {
  const endpoint = new URL('https://openlibrary.org/api/books');
  const key = `ISBN:${isbn}`;
  endpoint.searchParams.set('bibkeys', key);
  endpoint.searchParams.set('jscmd', 'data');
  endpoint.searchParams.set('format', 'json');
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Open Library lookup failed');
  const book = ((await response.json()) as Record<string, OpenLibraryBook>)[key];
  if (!book?.title) return null;
  const rawSeries = Array.isArray(book.series) ? book.series[0] : book.series;
  const series = rawSeries ? inferSeriesDetails(rawSeries) : {};
  return {
    title: book.title,
    author: book.authors?.map((candidate) => candidate.name).filter(Boolean).join(', ') ?? '',
    description: descriptionText(book.notes).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    isbn,
    seriesName: series.seriesName ?? rawSeries,
    seriesNumber: series.seriesNumber,
  };
}

function searchableTokens(value: string) {
  return new Set(
    value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1),
  );
}

export function coverSearchText(ocrText: string) {
  return ocrText
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\p{L}\p{N}'&: -]/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 2)
    .slice(0, 8)
    .join(' ')
    .slice(0, 180);
}

export async function findBookMatchFromCoverText(ocrText: string): Promise<BookMatch | null> {
  const query = coverSearchText(ocrText);
  if (!query) return null;
  const volumes = await googleBooks(query, 10);
  const scannedTokens = searchableTokens(query);
  const ranked = volumes
    .map((volume) => {
      const match = googleMatch(volume);
      if (!match) return null;
      const candidateTokens = searchableTokens(`${match.title} ${match.author}`);
      const overlap = [...candidateTokens].filter((token) => scannedTokens.has(token)).length;
      return { match, overlap };
    })
    .filter((candidate): candidate is { match: BookMatch; overlap: number } => Boolean(candidate))
    .sort((a, b) => b.overlap - a.overlap);
  return ranked[0]?.overlap ? ranked[0].match : null;
}

export async function findBookMatch({ title, author, isbn }: { title: string; author: string; isbn: string }): Promise<BookMatch | null> {
  const cleanIsbn = normalizeIsbn(isbn);
  if (cleanIsbn) {
    if (!isPossibleIsbn(cleanIsbn)) return null;
    try {
      const googleResult = (await googleBooks(`isbn:${cleanIsbn}`, 3))
        .map((volume) => googleMatch(volume, author))
        .find(Boolean);
      if (googleResult) return googleResult;
    } catch {
      // The independent fallback below keeps ISBN entry working if Google Books is unavailable.
    }
    return openLibraryIsbn(cleanIsbn);
  }

  const query = [title.trim() && `intitle:${title.trim()}`, author.trim() && `inauthor:${author.trim()}`]
    .filter(Boolean)
    .join(' ');
  if (!query) return null;
  const result = (await googleBooks(query, 3))
    .map((volume) => googleMatch(volume, author))
    .find(Boolean);
  return result ?? null;
}
