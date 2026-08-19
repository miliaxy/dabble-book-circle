import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookCard } from '../components/BookCard';
import { BookCover } from '../components/BookCover';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import {
  activeLoanForBook,
  bookMatchesQuery,
  bookSeriesLabel,
  displayStatus,
  dueLabel,
  formatDateIST,
  queuePosition,
  requestForFamily,
  waitingRequestsForBook,
} from '../domain';
import { newId, useApp } from '../state';
import type { AgeBand, BookCopy } from '../types';

const ageFilters: Array<'All ages' | AgeBand> = ['All ages', '3–5', '6–8', '9–12', '13+'];

export function Browse() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [age, setAge] = useState<(typeof ageFilters)[number]>('All ages');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookCopy | null>(null);

  const currentBorrow = state.loans.find(
    (loan) => loan.borrowerFamilyId === state.family.id && loan.status === 'borrowed',
  );
  const currentBorrowBook = state.books.find((book) => book.id === currentBorrow?.bookId);

  const books = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return state.books
      .filter((book) => book.ownerFamilyId !== state.family.id)
      .filter((book) => age === 'All ages' || book.ageBand === age)
      .filter((book) => !availableOnly || displayStatus(book, state.requests, state.loans) === 'available')
      .filter((book) => bookMatchesQuery(book, normalized))
      .sort((a, b) => {
        const aAvailable = displayStatus(a, state.requests, state.loans) === 'available' ? 0 : 1;
        const bAvailable = displayStatus(b, state.requests, state.loans) === 'available' ? 0 : 1;
        return aAvailable - bAvailable || b.createdAt.localeCompare(a.createdAt);
      });
  }, [age, availableOnly, query, state.books, state.family.id, state.loans, state.requests]);

  return (
    <div className="screen browse-screen">
      <header className="screen-heading browse-heading">
        <div><span className="browse-circle-mobile"><strong>{state.community.name}</strong><small>{state.community.memberCount} families</small></span><h1>Good evening, Arnaa.</h1><p>What would your family like to read next?</p></div>
      </header>

      {currentBorrow && currentBorrowBook && (
        <button className="due-card" type="button" onClick={() => navigate('/loans')}>
          <BookCover book={currentBorrowBook} size="small" />
          <span className="due-card-copy"><small>Borrowed by you</small><strong>{currentBorrowBook.title}</strong><span>{dueLabel(currentBorrow.dueAt)} · {formatDateIST(currentBorrow.dueAt)}</span></span>
          <span className="due-card-arrow" aria-hidden="true">→</span>
        </button>
      )}

      <section className="search-panel" aria-label="Search books">
        <label className="search-input"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, author, series or topic" /></label>
        <div className="filter-row">
          <div className="filter-scroll" aria-label="Filter by age">
            {ageFilters.map((filter) => <button className={age === filter ? 'filter-chip active' : 'filter-chip'} type="button" key={filter} onClick={() => setAge(filter)}>{filter}</button>)}
          </div>
          <label className="available-toggle"><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /><span>Available now</span></label>
        </div>
      </section>

      <section className="book-section">
        <div className="section-heading"><div><h2>Books in your circle</h2><p>{books.length} {books.length === 1 ? 'book' : 'books'} matching your filters</p></div></div>
        {books.length > 0 ? (
          <div className="book-grid">{books.map((book) => <BookCard key={book.id} book={book} requests={state.requests} loans={state.loans} onOpen={setSelectedBook} />)}</div>
        ) : (
          <div className="empty-state"><span aria-hidden="true">📚</span><h3>No books match those filters</h3><p>Try another age group or remove “Available now.”</p><button className="button button-quiet" type="button" onClick={() => { setQuery(''); setAge('All ages'); setAvailableOnly(false); }}>Clear filters</button></div>
        )}
      </section>

      {selectedBook && (
        <BookDetails book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
}

function BookDetails({ book, onClose }: { book: BookCopy; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const status = displayStatus(book, state.requests, state.loans);
  const existingRequest = requestForFamily(state.requests, book.id, state.family.id);
  const position = existingRequest ? queuePosition(state.requests, existingRequest.id) : null;
  const queue = waitingRequestsForBook(state.requests, book.id);
  const activeLoan = activeLoanForBook(state.loans, book.id);
  const borrowedByCurrentFamily = activeLoan?.borrowerFamilyId === state.family.id;
  const series = bookSeriesLabel(book);

  function requestBook() {
    dispatch({
      type: 'REQUEST_BOOK',
      request: {
        id: newId('request'),
        bookId: book.id,
        borrowerFamilyId: state.family.id,
        borrowerName: state.family.displayName,
        requestedAt: new Date().toISOString(),
        status: 'waiting',
      },
    });
  }

  return (
    <Modal title="Book details" onClose={onClose} wide>
      <div className="book-detail-layout">
        <BookCover book={book} size="large" />
        <div className="book-detail-copy">
          <div className="detail-status-row"><StatusPill status={status} />{queue.length > 0 && <span>{queue.length} {queue.length === 1 ? 'family' : 'families'} waiting</span>}</div>
          <h3>{book.title}</h3><p className="detail-author">by {book.author}</p>{series && <p className="detail-series"><span>Series</span>{series}</p>}<p className="detail-description">{book.description}</p>
          <dl className="detail-list"><div><dt>For readers</dt><dd>{book.ageBand} years</dd></div><div><dt>Type</dt><dd>{book.category}</dd></div><div><dt>Language</dt><dd>{book.language}</dd></div><div><dt>Condition</dt><dd>{book.condition}</dd></div></dl>
          <div className="owner-line"><span className="owner-avatar">{book.ownerName.charAt(0)}</span><div><small>Shared by</small><strong>{book.ownerName}</strong></div><span className="reliability-mini">✓ Trusted circle member</span></div>
          {book.goodreadsUrl && <a className="goodreads-link" href={book.goodreadsUrl} target="_blank" rel="noreferrer"><span aria-hidden="true">g</span> Find on Goodreads <b aria-hidden="true">↗</b></a>}

          <div className="detail-action-panel">
            {existingRequest ? (
              <><div><strong>You’re #{position} in the queue</strong><p>We’ll notify you when this book reaches you.</p></div><button className="button button-quiet" type="button" onClick={() => dispatch({ type: 'CANCEL_REQUEST', requestId: existingRequest.id })}>Leave queue</button></>
            ) : borrowedByCurrentFamily ? (
              <div><strong>Currently borrowed by your family</strong><p>Manage the return from your Loans screen.</p></div>
            ) : status === 'paused' ? (
              <div><strong>Not available for requests</strong><p>The owner has paused lending this book.</p></div>
            ) : (
              <><div><strong>{status === 'available' ? 'Available to borrow' : 'Join the queue'}</strong><p>The loan lasts seven days after you confirm receipt.</p></div><button className="button button-primary" type="button" onClick={requestBook}>{status === 'available' ? 'Request book' : 'Join queue'} <span aria-hidden="true">→</span></button></>
            )}
          </div>
          <p className="contact-privacy"><span aria-hidden="true">🔒</span> Parent contact details stay hidden until a handover is accepted.</p>
        </div>
      </div>
    </Modal>
  );
}
