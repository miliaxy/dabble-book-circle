import { useMemo, useState } from 'react';
import { BookCover } from '../components/BookCover';
import { HandoverContactDialog } from '../components/LoanDialogs';
import { dueLabel, formatDateIST, queuePosition } from '../domain';
import { useApp } from '../state';
import type { Loan } from '../types';

type BorrowingFilter = 'all' | 'waiting' | 'borrowing' | 'completed';

const borrowingFilters: Array<{ id: BorrowingFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'borrowing', label: 'Borrowing' },
  { id: 'completed', label: 'Completed' },
];

const emptyFilterCopy: Record<BorrowingFilter, { title: string; body: string }> = {
  all: { title: 'No borrowing activity', body: 'Browse your circle to find a book your family would enjoy.' },
  waiting: { title: 'No waiting requests', body: 'Books you request will appear here until they are accepted.' },
  borrowing: { title: 'No active loans', body: 'Books your family is currently borrowing will appear here.' },
  completed: { title: 'No completed loans yet', body: 'Returned books will appear here after the lender completes the loan.' },
};

export function Loans() {
  const { state, dispatch } = useApp();
  const [filter, setFilter] = useState<BorrowingFilter>('all');
  const [contactLoan, setContactLoan] = useState<Loan | null>(null);
  const borrowerLoans = useMemo(
    () => state.loans.filter((loan) => loan.borrowerFamilyId === state.family.id),
    [state.family.id, state.loans],
  );
  const activeLoans = borrowerLoans.filter((loan) => !['completed', 'cancelled', 'feedback_pending'].includes(loan.status));
  const completedLoans = borrowerLoans.filter((loan) => ['completed', 'feedback_pending'].includes(loan.status));
  const waitingRequests = state.requests.filter((request) => request.borrowerFamilyId === state.family.id && request.status === 'waiting');
  const counts: Record<BorrowingFilter, number> = {
    all: activeLoans.length + waitingRequests.length + completedLoans.length,
    waiting: waitingRequests.length,
    borrowing: activeLoans.length,
    completed: completedLoans.length,
  };
  const hasVisibleItems =
    (filter === 'all' && counts.all > 0) ||
    (filter === 'waiting' && waitingRequests.length > 0) ||
    (filter === 'borrowing' && activeLoans.length > 0) ||
    (filter === 'completed' && completedLoans.length > 0);

  return (
    <div className="screen loans-screen">
      <header className="screen-heading"><h1>Your borrowing</h1><p>Books your family has requested, borrowed or returned.</p></header>

      <section className="summary-grid" aria-label="Your borrowing summary">
        <article><span className="summary-icon summary-purple">↗</span><div><strong>{activeLoans.length}</strong><small>Active loans</small></div></article>
        <article><span className="summary-icon summary-amber">◷</span><div><strong>{waitingRequests.length}</strong><small>Waiting requests</small></div></article>
        <article><span className="summary-icon summary-teal">✓</span><div><strong>{completedLoans.length}</strong><small>Completed loans</small></div></article>
      </section>

      <div className="section-heading borrowing-list-heading"><div><h2>Your loans and requests</h2><p>Track each request from queue to return.</p></div></div>
      <div className="lending-filter-row" role="group" aria-label="Filter your borrowing">
        {borrowingFilters.map((option) => <button className={`lending-filter${filter === option.id ? ' active' : ''}`} type="button" key={option.id} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}<span>{counts[option.id]}</span></button>)}
      </div>

      {!hasVisibleItems && <div className="empty-state"><span>⇄</span><h3>{emptyFilterCopy[filter].title}</h3><p>{emptyFilterCopy[filter].body}</p>{filter !== 'all' && <button className="button button-quiet" type="button" onClick={() => setFilter('all')}>Show all borrowing</button>}</div>}

      {(filter === 'all' || filter === 'borrowing') && activeLoans.length > 0 && <section className="loan-section"><div className="section-heading"><div><h2>Borrowing now</h2><p>{activeLoans.length} active {activeLoans.length === 1 ? 'loan' : 'loans'}</p></div></div><div className="loan-list">{activeLoans.map((loan) => <BorrowerLoanCard key={loan.id} loan={loan} onContact={() => setContactLoan(loan)} />)}</div></section>}

      {(filter === 'all' || filter === 'waiting') && waitingRequests.length > 0 && <section className="loan-section"><div className="section-heading"><div><h2>Waiting for a book</h2><p>Requests that have not yet been accepted</p></div></div><div className="queue-list">{waitingRequests.map((request) => { const book = state.books.find((candidate) => candidate.id === request.bookId); if (!book) return null; const position = queuePosition(state.requests, request.id); return <article className="queue-row" key={request.id}><BookCover book={book} size="small" /><div><span className="queue-position">#{position} in queue</span><h3>{book.title}</h3><p>Shared by {book.ownerName}</p></div><button className="button button-quiet button-small" type="button" onClick={() => dispatch({ type: 'CANCEL_REQUEST', requestId: request.id })}>Leave queue</button></article>; })}</div></section>}

      {(filter === 'all' || filter === 'completed') && completedLoans.length > 0 && <section className="loan-section"><div className="section-heading"><div><h2>Completed</h2><p>Books your family has returned</p></div></div><div className="loan-list">{completedLoans.map((loan) => <BorrowerLoanCard key={loan.id} loan={loan} onContact={() => setContactLoan(loan)} />)}</div></section>}

      {contactLoan && <HandoverContactDialog loan={contactLoan} onClose={() => setContactLoan(null)} />}
    </div>
  );
}

function BorrowerLoanCard({ loan, onContact }: { loan: Loan; onContact: () => void }) {
  const { state, dispatch } = useApp();
  const book = state.books.find((candidate) => candidate.id === loan.bookId);
  if (!book) return null;
  const copy = borrowerLoanCopy(loan);

  return (
    <article className={`loan-card loan-${loan.status}`}>
      <div className="loan-card-main"><BookCover book={book} size="small" /><div className="loan-card-copy"><span className="loan-role">Your family is borrowing</span><h3>{book.title}</h3><p>From {loan.lenderName}</p></div><span className="loan-state">{copy.label}</span></div>
      <div className="loan-timeline"><span className="timeline-dot active" /><div><strong>{copy.title}</strong><p>{copy.description}</p>{loan.dueAt && <small>{dueLabel(loan.dueAt)} · {formatDateIST(loan.dueAt)}</small>}</div></div>
      {!['completed', 'feedback_pending'].includes(loan.status) && <div className="loan-actions">
        {state.preferences.shareWhatsappDuringHandover && <button className="button button-quiet button-small" type="button" onClick={onContact}>WhatsApp handover</button>}
        {loan.status === 'awaiting_receipt' && <button className="button button-primary button-small" type="button" onClick={() => dispatch({ type: 'CONFIRM_RECEIVED', loanId: loan.id, now: new Date().toISOString() })}>I received it</button>}
        {loan.status === 'borrowed' && <button className="button button-primary button-small" type="button" onClick={() => dispatch({ type: 'MARK_RETURNED', loanId: loan.id, now: new Date().toISOString() })}>I returned it</button>}
      </div>}
    </article>
  );
}

function borrowerLoanCopy(loan: Loan) {
  switch (loan.status) {
    case 'handover_ready': return { label: 'Arrange handover', title: 'Request accepted', description: 'The lender will coordinate a handover with you.' };
    case 'awaiting_receipt': return { label: 'Confirm receipt', title: 'Book handed over', description: 'Confirm receipt to start the seven-day loan.' };
    case 'borrowed': return { label: 'Borrowed', title: 'Seven-day loan active', description: 'Return the book by the due date and mark it returned.' };
    case 'return_pending': return { label: 'Return pending', title: 'You marked the book returned', description: 'Waiting for the lender to confirm receipt.' };
    case 'feedback_pending': return { label: 'Returned', title: 'Return confirmed', description: 'The lender is completing the private return record.' };
    default: return { label: 'Completed', title: 'Loan completed', description: 'This book has been returned.' };
  }
}
