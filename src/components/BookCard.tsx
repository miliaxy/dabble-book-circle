import { bookSeriesLabel, displayStatus, waitingRequestsForBook } from '../domain';
import type { BookCopy, BorrowRequest, Loan } from '../types';
import { BookCover } from './BookCover';
import { StatusPill } from './StatusPill';

interface BookCardProps {
  book: BookCopy;
  requests: BorrowRequest[];
  loans: Loan[];
  onOpen: (book: BookCopy) => void;
}

export function BookCard({ book, requests, loans, onOpen }: BookCardProps) {
  const status = displayStatus(book, requests, loans);
  const queueLength = waitingRequestsForBook(requests, book.id).length;
  const series = bookSeriesLabel(book);
  return (
    <button className="book-card" type="button" onClick={() => onOpen(book)}>
      <BookCover book={book} />
      <span className="book-card-copy">
        <span className="book-card-topline">
          <StatusPill status={status} />
          {queueLength > 0 && <span className="queue-count">{queueLength} waiting</span>}
        </span>
        <strong>{book.title}</strong>
        <span className="book-author">{book.author}</span>
        {series && <span className="book-series">{series}</span>}
        <span className="book-meta">{book.ageBand} yrs · {book.language}</span>
      </span>
    </button>
  );
}
