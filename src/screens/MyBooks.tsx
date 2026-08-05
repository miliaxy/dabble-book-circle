import { type FormEvent, useMemo, useState } from 'react';
import { findBookMatch } from '../bookLookup';
import { BookCover } from '../components/BookCover';
import { HandoverContactDialog, LoanFeedbackDialog } from '../components/LoanDialogs';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { goodreadsSearchUrl } from '../data';
import { activeLoanForBook, displayStatus, dueLabel, formatDateIST, waitingRequestsForBook } from '../domain';
import { compressImage } from '../image';
import { newId, useApp } from '../state';
import type { AgeBand, BookCategory, BookCondition, BookLanguage, BorrowRequest, Loan } from '../types';

const categories: BookCategory[] = ['Picture book', 'Early reader', 'Chapter book', 'Comic & graphic novel', 'Mythology', 'Science & nature', 'General knowledge'];
const ages: AgeBand[] = ['3–5', '6–8', '9–12', '13+'];
const languages: BookLanguage[] = ['English', 'Hindi', 'Bilingual'];
const conditions: BookCondition[] = ['Like new', 'Good', 'Well loved'];
type LendingFilter = 'listed' | 'available' | 'borrowed' | 'unavailable';
const lendingFilters: Array<{ id: LendingFilter; label: string }> = [
  { id: 'listed', label: 'Listed' },
  { id: 'available', label: 'Available to borrow' },
  { id: 'borrowed', label: 'Borrowed' },
  { id: 'unavailable', label: 'Unavailable' },
];
const emptyFilterHeadings: Record<LendingFilter, string> = {
  listed: 'No books listed',
  available: 'No books available to borrow',
  borrowed: 'No books are currently borrowed',
  unavailable: 'No unavailable books',
};
const declineReasons = [
  'Book is temporarily unavailable',
  'Unable to coordinate handover',
  'We are not lending this book right now',
  'Other',
] as const;
const lenderWorkflowStatuses = ['handover_ready', 'awaiting_receipt', 'borrowed', 'return_pending', 'feedback_pending'];

export function MyBooks() {
  const { state, dispatch } = useApp();
  const [adding, setAdding] = useState(false);
  const [lendingFilter, setLendingFilter] = useState<LendingFilter>('listed');
  const [declining, setDeclining] = useState<{ request: BorrowRequest; bookTitle: string } | null>(null);
  const [contactLoan, setContactLoan] = useState<Loan | null>(null);
  const [feedbackLoan, setFeedbackLoan] = useState<Loan | null>(null);
  const ownedBooks = useMemo(() => state.books.filter((book) => book.ownerFamilyId === state.family.id), [state.books, state.family.id]);
  const [expandedQueueBookId, setExpandedQueueBookId] = useState<string | null>(() =>
    ownedBooks.find((book) => waitingRequestsForBook(state.requests, book.id).length > 0)?.id ?? null,
  );
  const currentlyLent = ownedBooks.filter((book) => activeLoanForBook(state.loans, book.id)).length;
  const waiting = ownedBooks.reduce((count, book) => count + waitingRequestsForBook(state.requests, book.id).length, 0);
  const lendingCounts: Record<LendingFilter, number> = {
    listed: ownedBooks.length,
    available: ownedBooks.filter((book) => book.available && !activeLoanForBook(state.loans, book.id)).length,
    borrowed: currentlyLent,
    unavailable: ownedBooks.filter((book) => !book.available && !activeLoanForBook(state.loans, book.id)).length,
  };
  const filteredOwnedBooks = ownedBooks.filter((book) => {
    const activeLoan = activeLoanForBook(state.loans, book.id);
    if (lendingFilter === 'available') return book.available && !activeLoan;
    if (lendingFilter === 'borrowed') return Boolean(activeLoan);
    if (lendingFilter === 'unavailable') return !book.available && !activeLoan;
    return true;
  });

  return (
    <div className="screen my-books-screen">
      <header className="screen-heading action-heading"><div><h1>Books you lend</h1><p>Add books your family owns, choose what is available to borrow, and review each queue.</p></div><button className="button button-primary" type="button" onClick={() => setAdding(true)}><span aria-hidden="true">＋</span> Add a book</button></header>

      <section className="summary-grid" aria-label="Your lending summary">
        <article><span className="summary-icon summary-teal">▤</span><div><strong>{ownedBooks.length}</strong><small>Books listed</small></div></article>
        <article><span className="summary-icon summary-purple">↗</span><div><strong>{currentlyLent}</strong><small>Currently lent</small></div></article>
        <article><span className="summary-icon summary-amber">◷</span><div><strong>{waiting}</strong><small>Borrow requests</small></div></article>
      </section>

      <section className="owned-list-section">
        <div className="section-heading"><div><h2>Your lending list</h2><p>Only families in {state.community.name} can see these books. Switch off “Available to borrow” to stop new requests; families already waiting will stay in the queue.</p></div></div>
        <div className="lending-filter-row" role="group" aria-label="Filter your lending list">
          {lendingFilters.map((filter) => <button className={`lending-filter${lendingFilter === filter.id ? ' active' : ''}`} type="button" key={filter.id} aria-pressed={lendingFilter === filter.id} onClick={() => setLendingFilter(filter.id)}>{filter.label}<span>{lendingCounts[filter.id]}</span></button>)}
        </div>
        <div className="owned-book-list">
          {filteredOwnedBooks.map((book) => {
            const status = displayStatus(book, state.requests, state.loans);
            const queue = waitingRequestsForBook(state.requests, book.id);
            const activeLoan = activeLoanForBook(state.loans, book.id);
            const lenderWorkflowLoan = state.loans.find((loan) =>
              loan.bookId === book.id &&
              loan.lenderFamilyId === state.family.id &&
              lenderWorkflowStatuses.includes(loan.status),
            );
            const queueOpen = expandedQueueBookId === book.id && queue.length > 0;
            return (
              <article className="owned-book-row" key={book.id}>
                <BookCover book={book} size="small" />
                <div className="owned-book-copy"><div><StatusPill status={status} />{queue.length > 0 && <span className="queue-count">{queue.length} {queue.length === 1 ? 'family' : 'families'} waiting</span>}</div><h3>{book.title}</h3><p>{book.author} · {book.condition}</p>{activeLoan && <small>With {activeLoan.borrowerName}</small>}</div>
                <div className="owned-book-actions">
                  {queue.length > 0 && <button className="button button-quiet button-small" type="button" aria-expanded={queueOpen} aria-controls={`queue-${book.id}`} onClick={() => setExpandedQueueBookId(queueOpen ? null : book.id)}>{queueOpen ? 'Hide queue' : `View queue (${queue.length})`}</button>}
                  <label className={`switch-control${activeLoan ? ' disabled' : ''}`}><input type="checkbox" checked={book.available} disabled={Boolean(activeLoan)} aria-label={`${book.available ? 'Stop' : 'Start'} lending ${book.title}`} onChange={() => dispatch({ type: 'TOGGLE_BOOK', bookId: book.id })} /><span /><small>{activeLoan ? 'Unavailable during loan' : book.available ? 'Available to borrow' : 'Not available to borrow'}</small></label>
                </div>
                {queueOpen && <section className="lender-queue" id={`queue-${book.id}`} aria-label={`Borrow queue for ${book.title}`}><div className="lender-queue-heading"><div><strong>Borrow queue</strong><p>Requests are served in this order.</p></div><span>{queue.length} {queue.length === 1 ? 'family' : 'families'}</span></div><ol>{queue.map((request, index) => <li key={request.id}><span className="lender-queue-position">{index + 1}</span><div><strong>{request.borrowerName}</strong><small>Requested {formatDateIST(request.requestedAt)}</small></div><span className="lender-queue-actions">{index === 0 && !activeLoan && <button className="button button-primary button-small" type="button" onClick={() => dispatch({ type: 'ACCEPT_NEXT_REQUEST', bookId: book.id, loanId: newId('loan'), now: new Date().toISOString() })}>Accept request</button>}<button className="button button-quiet button-small decline-request-button" type="button" onClick={() => setDeclining({ request, bookTitle: book.title })}>Decline</button></span></li>)}</ol></section>}
                {lenderWorkflowLoan && <LenderLoanPanel loan={lenderWorkflowLoan} onContact={() => setContactLoan(lenderWorkflowLoan)} onFeedback={() => setFeedbackLoan(lenderWorkflowLoan)} />}
              </article>
            );
          })}
          {filteredOwnedBooks.length === 0 && <div className="empty-state lending-empty"><span aria-hidden="true">📚</span><h3>{emptyFilterHeadings[lendingFilter]}</h3><p>Choose another filter to view the rest of your lending list.</p><button className="button button-quiet" type="button" onClick={() => setLendingFilter('listed')}>Show all listed books</button></div>}
        </div>
      </section>

      {adding && <AddBook onClose={() => setAdding(false)} />}
      {declining && <DeclineRequest request={declining.request} bookTitle={declining.bookTitle} onClose={() => setDeclining(null)} onConfirm={(reason) => { dispatch({ type: 'DECLINE_REQUEST', requestId: declining.request.id, reason, now: new Date().toISOString() }); setDeclining(null); }} />}
      {contactLoan && <HandoverContactDialog loan={contactLoan} onClose={() => setContactLoan(null)} />}
      {feedbackLoan && <LoanFeedbackDialog loan={feedbackLoan} onClose={() => setFeedbackLoan(null)} />}
    </div>
  );
}

function LenderLoanPanel({ loan, onContact, onFeedback }: { loan: Loan; onContact: () => void; onFeedback: () => void }) {
  const { state, dispatch } = useApp();
  const copy = lenderLoanCopy(loan);

  function confirmReturn() {
    dispatch({ type: 'CONFIRM_RETURN', loanId: loan.id, now: new Date().toISOString() });
    onFeedback();
  }

  return (
    <section className="lender-active-loan" aria-label={`Lending status for ${loan.borrowerName}`}>
      <div className="lender-active-loan-copy">
        <span>Active lending</span>
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
        {loan.dueAt && <small>{dueLabel(loan.dueAt)} · {formatDateIST(loan.dueAt)}</small>}
      </div>
      <div className="lender-active-loan-actions">
        {state.preferences.shareWhatsappDuringHandover && loan.status !== 'feedback_pending' && <button className="button button-quiet button-small" type="button" onClick={onContact}>WhatsApp handover</button>}
        {loan.status === 'handover_ready' && <button className="button button-primary button-small" type="button" onClick={() => dispatch({ type: 'MARK_HANDED_OVER', loanId: loan.id, now: new Date().toISOString() })}>I handed it over</button>}
        {loan.status === 'return_pending' && <button className="button button-primary button-small" type="button" onClick={confirmReturn}>Confirm I received it</button>}
        {loan.status === 'feedback_pending' && <button className="button button-primary button-small" type="button" onClick={onFeedback}>Leave return feedback</button>}
      </div>
    </section>
  );
}

function lenderLoanCopy(loan: Loan) {
  switch (loan.status) {
    case 'handover_ready': return { title: `Lending to ${loan.borrowerName}`, description: 'Arrange the handover, then confirm when you have handed over the book.' };
    case 'awaiting_receipt': return { title: `Handed to ${loan.borrowerName}`, description: 'Waiting for the borrowing family to confirm they received the book.' };
    case 'borrowed': return { title: `With ${loan.borrowerName}`, description: 'The seven-day loan is active. The borrower will mark the book returned.' };
    case 'return_pending': return { title: `${loan.borrowerName} marked it returned`, description: 'Confirm that you received the book back, then record its return condition.' };
    default: return { title: 'Return confirmed', description: 'Complete the private return feedback to close this loan.' };
  }
}

function DeclineRequest({ request, bookTitle, onClose, onConfirm }: { request: BorrowRequest; bookTitle: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState<(typeof declineReasons)[number] | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const sharedReason = reason === 'Other' ? otherReason.trim() : reason;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!sharedReason) return;
    onConfirm(sharedReason);
  }

  return (
    <Modal title="Decline borrow request?" onClose={onClose}>
      <form className="decline-request-confirmation" onSubmit={submit}>
        <span aria-hidden="true">↩</span>
        <h3>Decline {request.borrowerName}’s request?</h3>
        <p>They will be removed from the queue for <strong>{bookTitle}</strong>. Choose a reason to share with them.</p>
        <fieldset className="decline-reason-fieldset"><legend>Reason for declining</legend>{declineReasons.map((option) => <label key={option}><input type="radio" name="decline-reason" value={option} checked={reason === option} onChange={() => setReason(option)} /><span>{option}</span></label>)}</fieldset>
        {reason === 'Other' && <label className="decline-other-reason">Short explanation<textarea value={otherReason} onChange={(event) => setOtherReason(event.target.value)} minLength={3} maxLength={180} rows={3} placeholder="Write a short, respectful explanation" required /></label>}
        <p className="decline-share-note">This reason will be shared with {request.borrowerName}. Declining does not affect their reliability record.</p>
        <div className="form-actions"><button className="button button-quiet" type="button" onClick={onClose}>Keep request</button><button className="button button-danger" type="submit" disabled={!sharedReason}>Decline and send reason</button></div>
      </form>
    </Modal>
  );
}

function AddBook({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [photo, setPhoto] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [description, setDescription] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('6–8');
  const [category, setCategory] = useState<BookCategory>('Chapter book');
  const [language, setLanguage] = useState<BookLanguage>('English');
  const [condition, setCondition] = useState<BookCondition>('Good');
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'missing' | 'error'>('idle');
  const [error, setError] = useState('');

  async function loadPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose a photo of the book cover.'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('The photo is too large. Choose one under 12 MB.'); return; }
    setError('');
    setPhoto(await compressImage(file));
  }

  async function findDetails() {
    if (!title.trim() && !isbn.trim()) { setError('Add the title or ISBN before looking up details.'); return; }
    setError(''); setLookupState('loading');
    try {
      const match = await findBookMatch({ title, author, isbn });
      if (!match) { setLookupState('missing'); return; }
      setTitle(match.title); setAuthor(match.author); setDescription(match.description); if (match.isbn) setIsbn(match.isbn); setLookupState('found');
    } catch { setLookupState('error'); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!photo) { setError('Start by taking or choosing a cover photo.'); return; }
    if (!title.trim()) { setError('Confirm the book title.'); return; }
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    dispatch({ type: 'ADD_BOOK', book: {
      id: newId('book'), title: title.trim(), author: author.trim() || 'Author not listed', description: description.trim() || 'Shared by a family in your private Book Circle.', ownerFamilyId: state.family.id, ownerName: state.family.displayName, ageBand, category, language, condition, available: true, coverImage: photo, coverEmoji: '📘', coverStyle: 'mint-sky', isbn: cleanIsbn || undefined, goodreadsUrl: cleanIsbn ? `https://www.goodreads.com/book/isbn/${encodeURIComponent(cleanIsbn)}` : goodreadsSearchUrl(title, author), createdAt: new Date().toISOString(),
    } });
    onClose();
  }

  return (
    <Modal title="Add a book" onClose={onClose} wide>
      <form className="add-book-form" onSubmit={submit}>
        <section className="photo-first-panel">
          <label className={photo ? 'photo-drop has-photo' : 'photo-drop'}>
            {photo ? <img src={photo} alt="Book cover preview" /> : <><span className="camera-icon" aria-hidden="true">📷</span><strong>Photograph the front cover</strong><small>Use your camera or choose an existing photo</small></>}
            <input type="file" accept="image/*" capture="environment" onChange={(event) => void loadPhoto(event.target.files?.[0])} />
          </label>
          <div className="photo-help"><span aria-hidden="true">✨</span><p><strong>Photo-first listing</strong><br />Cover recognition will be completed through the private backend. For this preview, confirm the title below.</p></div>
        </section>

        <section className="book-fields">
          <div className="field-grid"><label>Book title <b>*</b><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. The Wild Robot" /></label><label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="e.g. Peter Brown" /></label></div>
          <div className="lookup-row"><label>ISBN, if visible<input inputMode="numeric" value={isbn} onChange={(event) => setIsbn(event.target.value)} placeholder="Back-cover barcode number" /></label><button className="button button-quiet" type="button" disabled={lookupState === 'loading'} onClick={() => void findDetails()}>{lookupState === 'loading' ? 'Finding…' : 'Find book details'}</button></div>
          {lookupState === 'found' && <p className="lookup-message success">✓ Details found. Please confirm they match your copy.</p>}
          {lookupState === 'missing' && <p className="lookup-message">We could not find an exact match. You can still list the book.</p>}
          {lookupState === 'error' && <p className="lookup-message">Lookup is unavailable. You can still list the book.</p>}
          <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="A short description helps other parents." /></label>
          <div className="field-grid field-grid-three"><label>Reader age<select value={ageBand} onChange={(event) => setAgeBand(event.target.value as AgeBand)}>{ages.map((value) => <option key={value}>{value}</option>)}</select></label><label>Language<select value={language} onChange={(event) => setLanguage(event.target.value as BookLanguage)}>{languages.map((value) => <option key={value}>{value}</option>)}</select></label><label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value as BookCondition)}>{conditions.map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <label>Book type<select value={category} onChange={(event) => setCategory(event.target.value as BookCategory)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">Add to lending list <span aria-hidden="true">→</span></button></div>
        </section>
      </form>
    </Modal>
  );
}
