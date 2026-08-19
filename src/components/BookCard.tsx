import { bookSeriesLabel, displayStatus, groupDisplayStatus, waitingRequestsForBook } from '../domain';
import type { BookCopy, BorrowRequest, Loan } from '../types';
import { BookCover } from './BookCover';
import { StatusPill } from './StatusPill';

interface BookCardProps {
  books: BookCopy[];
  requests: BorrowRequest[];
  loans: Loan[];
  onOpen: (books: BookCopy[]) => void;
}

export function BookCard({ books, requests, loans, onOpen }: BookCardProps) {
  const rankedBooks = [...books].sort((first, second) => {
    const firstAvailable = displayStatus(first, requests, loans) === 'available' ? 0 : 1;
    const secondAvailable = displayStatus(second, requests, loans) === 'available' ? 0 : 1;
    return firstAvailable - secondAvailable || second.createdAt.localeCompare(first.createdAt);
  });
  const book = rankedBooks[0];
  const statuses = rankedBooks.map((copy) => displayStatus(copy, requests, loans));
  const availableCount = statuses.filter((status) => status === 'available').length;
  const status = groupDisplayStatus(rankedBooks, requests, loans);
  const queueLength = waitingRequestsForBook(requests, book.id).length;
  const series = bookSeriesLabel(book);
  return (
    <button className="book-card" type="button" onClick={() => onOpen(rankedBooks)}>
      <BookCover book={book} />
      <span className="book-card-copy">
        <span className="book-card-topline">
          <StatusPill status={status} />
          {rankedBooks.length > 1 ? <span className="copy-count">{rankedBooks.length} copies</span> : queueLength > 0 && <span className="queue-count">{queueLength} waiting</span>}
        </span>
        <strong>{book.title}</strong>
        <span className="book-author">{book.author}</span>
        {series && <span className="book-series">{series}</span>}
        {rankedBooks.length > 1 && <span className="book-copy-summary">{availableCount} of {rankedBooks.length} available</span>}
        <span className="book-meta">{book.ageBand} yrs · {book.language}</span>
      </span>
    </button>
  );
}
