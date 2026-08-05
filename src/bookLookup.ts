interface GoogleBookVolume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
}

export interface BookMatch {
  title: string;
  author: string;
  description: string;
  isbn?: string;
}

export async function findBookMatch({ title, author, isbn }: { title: string; author: string; isbn: string }): Promise<BookMatch | null> {
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
  const query = cleanIsbn
    ? `isbn:${cleanIsbn}`
    : [title.trim() && `intitle:${title.trim()}`, author.trim() && `inauthor:${author.trim()}`]
        .filter(Boolean)
        .join(' ');
  if (!query) return null;
  const endpoint = new URL('https://www.googleapis.com/books/v1/volumes');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('maxResults', '3');
  endpoint.searchParams.set('printType', 'books');
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Book lookup is temporarily unavailable');
  const payload = (await response.json()) as { items?: GoogleBookVolume[] };
  const info = payload.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  const matchedIsbn = info.industryIdentifiers?.find((identifier) => identifier.type === 'ISBN_13')?.identifier
    ?? info.industryIdentifiers?.find((identifier) => identifier.type === 'ISBN_10')?.identifier;
  return {
    title: info.title,
    author: info.authors?.join(', ') ?? author,
    description: info.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '',
    isbn: matchedIsbn,
  };
}
