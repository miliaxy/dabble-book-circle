import type {
  AppAction,
  AppState,
  BookCopy,
  BookDisplayStatus,
  BorrowRequest,
  Loan,
} from './types';

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_LOAN_STATES = new Set<Loan['status']>([
  'handover_ready',
  'awaiting_receipt',
  'borrowed',
  'return_pending',
]);

export function activeLoanForBook(loans: Loan[], bookId: string) {
  return loans.find((loan) => loan.bookId === bookId && ACTIVE_LOAN_STATES.has(loan.status));
}

export function waitingRequestsForBook(requests: BorrowRequest[], bookId: string) {
  return requests
    .filter((request) => request.bookId === bookId && request.status === 'waiting')
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
}

export function requestForFamily(requests: BorrowRequest[], bookId: string, familyId: string) {
  return requests.find(
    (request) =>
      request.bookId === bookId &&
      request.borrowerFamilyId === familyId &&
      request.status === 'waiting',
  );
}

export function queuePosition(requests: BorrowRequest[], requestId: string) {
  const request = requests.find((candidate) => candidate.id === requestId);
  if (!request || request.status !== 'waiting') return null;
  const queue = waitingRequestsForBook(requests, request.bookId);
  const index = queue.findIndex((candidate) => candidate.id === requestId);
  return index === -1 ? null : index + 1;
}

export function displayStatus(
  book: BookCopy,
  requests: BorrowRequest[],
  loans: Loan[],
): BookDisplayStatus {
  const loan = activeLoanForBook(loans, book.id);
  if (loan?.status === 'borrowed' || loan?.status === 'return_pending') return 'borrowed';
  if (loan) return 'reserved';
  if (!book.available) return 'paused';
  if (waitingRequestsForBook(requests, book.id).length > 0) return 'queued';
  return 'available';
}

export function groupDisplayStatus(books: BookCopy[], requests: BorrowRequest[], loans: Loan[]): BookDisplayStatus {
  const statuses = books.map((book) => displayStatus(book, requests, loans));
  if (statuses.includes('available')) return 'available';
  if (statuses.includes('queued')) return 'queued';
  if (statuses.includes('reserved')) return 'reserved';
  if (statuses.includes('borrowed')) return 'borrowed';
  return 'paused';
}

export function addSevenDays(isoDate: string) {
  return new Date(new Date(isoDate).getTime() + 7 * DAY).toISOString();
}

export function bookSeriesLabel(book: Pick<BookCopy, 'seriesName' | 'seriesNumber'>) {
  const name = book.seriesName?.trim();
  if (!name) return '';
  const number = book.seriesNumber?.trim();
  return number ? `${name} · Book ${number}` : name;
}

export function bookMatchesQuery(
  book: Pick<BookCopy, 'title' | 'author' | 'seriesName' | 'category' | 'language'>,
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [book.title, book.author, book.seriesName, book.category, book.language]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
    .includes(normalized);
}

function normalizedBookIdentity(value: string) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function bookGroupKey(book: Pick<BookCopy, 'isbn' | 'title' | 'author'>) {
  const isbn = book.isbn?.replace(/[^0-9X]/gi, '').toUpperCase();
  if (isbn) return `isbn:${isbn}`;
  return `book:${normalizedBookIdentity(book.title)}|${normalizedBookIdentity(book.author)}`;
}

export function sameBookGroup(first: Pick<BookCopy, 'isbn' | 'title' | 'author'>, second: Pick<BookCopy, 'isbn' | 'title' | 'author'>) {
  return bookGroupKey(first) === bookGroupKey(second);
}

export function formatDateIST(isoDate?: string) {
  if (!isoDate) return 'Not started';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(isoDate));
}

export function dueLabel(isoDate?: string, now = new Date()) {
  if (!isoDate) return 'Due date starts after receipt';
  const difference = new Date(isoDate).getTime() - now.getTime();
  const days = Math.ceil(difference / DAY);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

function updateLoan(state: AppState, loanId: string, updater: (loan: Loan) => Loan): AppState {
  return {
    ...state,
    loans: state.loans.map((loan) => (loan.id === loanId ? updater(loan) : loan)),
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, signedIn: true };
    case 'SIGN_OUT':
      return { ...state, signedIn: false };
    case 'ADD_BOOK':
      return { ...state, books: [action.book, ...state.books] };
    case 'TOGGLE_BOOK':
      return {
        ...state,
        books: state.books.map((book) =>
          book.id === action.bookId ? { ...book, available: !book.available } : book,
        ),
      };
    case 'REQUEST_BOOK':
      {
        const requestedBook = state.books.find((book) => book.id === action.request.bookId);
        const matchingBookIds = requestedBook
          ? new Set(state.books.filter((book) => sameBookGroup(book, requestedBook)).map((book) => book.id))
          : new Set([action.request.bookId]);
        const hasMatchingRequest = state.requests.some((request) =>
          matchingBookIds.has(request.bookId)
          && request.borrowerFamilyId === action.request.borrowerFamilyId
          && request.status === 'waiting');
        const hasMatchingLoan = state.loans.some((loan) =>
          matchingBookIds.has(loan.bookId)
          && loan.borrowerFamilyId === action.request.borrowerFamilyId
          && ACTIVE_LOAN_STATES.has(loan.status));
        if (hasMatchingRequest || hasMatchingLoan) return state;
      }
      return { ...state, requests: [...state.requests, action.request] };
    case 'CANCEL_REQUEST':
      return {
        ...state,
        requests: state.requests.map((request) =>
          request.id === action.requestId ? { ...request, status: 'cancelled' } : request,
        ),
      };
    case 'DECLINE_REQUEST': {
      const request = state.requests.find((candidate) => candidate.id === action.requestId);
      const book = request
        ? state.books.find((candidate) => candidate.id === request.bookId)
        : undefined;
      const reason = action.reason.trim();
      if (!request || request.status !== 'waiting' || book?.ownerFamilyId !== state.family.id || reason.length < 3) {
        return state;
      }
      return {
        ...state,
        requests: state.requests.map((candidate) =>
          candidate.id === action.requestId
            ? { ...candidate, status: 'declined', declinedAt: action.now, declineReason: reason }
            : candidate,
        ),
      };
    }
    case 'ACCEPT_NEXT_REQUEST': {
      if (activeLoanForBook(state.loans, action.bookId)) return state;
      const nextRequest = waitingRequestsForBook(state.requests, action.bookId)[0];
      const book = state.books.find((candidate) => candidate.id === action.bookId);
      if (!nextRequest || !book || book.ownerFamilyId !== state.family.id) return state;
      const loan: Loan = {
        id: action.loanId,
        bookId: book.id,
        lenderFamilyId: state.family.id,
        lenderName: state.family.displayName,
        borrowerFamilyId: nextRequest.borrowerFamilyId,
        borrowerName: nextRequest.borrowerName,
        status: 'handover_ready',
        acceptedAt: action.now,
      };
      return {
        ...state,
        requests: state.requests.map((request) =>
          request.id === nextRequest.id ? { ...request, status: 'accepted' } : request,
        ),
        loans: [loan, ...state.loans],
      };
    }
    case 'MARK_HANDED_OVER':
      return updateLoan(state, action.loanId, (loan) => ({
        ...loan,
        status: 'awaiting_receipt',
        handedOverAt: action.now,
      }));
    case 'CONFIRM_RECEIVED':
      return updateLoan(state, action.loanId, (loan) => ({
        ...loan,
        status: 'borrowed',
        receivedAt: action.now,
        dueAt: addSevenDays(action.now),
      }));
    case 'MARK_RETURNED':
      return updateLoan(state, action.loanId, (loan) => ({
        ...loan,
        status: 'return_pending',
        borrowerMarkedReturnedAt: action.now,
      }));
    case 'CONFIRM_RETURN':
      return updateLoan(state, action.loanId, (loan) => ({
        ...loan,
        status: 'feedback_pending',
        lenderConfirmedReturnedAt: action.now,
      }));
    case 'SUBMIT_FEEDBACK':
      return {
        ...updateLoan(state, action.feedback.loanId, (loan) => ({ ...loan, status: 'completed' })),
        feedback: [...state.feedback, action.feedback],
      };
    case 'SET_WHATSAPP_SHARING':
      return {
        ...state,
        preferences: { ...state.preferences, shareWhatsappDuringHandover: action.enabled },
      };
    case 'SET_EMAIL_REMINDERS':
      return {
        ...state,
        preferences: { ...state.preferences, emailReminders: action.enabled },
      };
    case 'CREATE_CIRCLE_INVITATION':
      if (state.community.role !== 'admin') return state;
      return {
        ...state,
        circleInvitations: [
          action.invitation,
          ...state.circleInvitations.map((invitation) =>
            invitation.recipientEmail.toLowerCase() === action.invitation.recipientEmail.toLowerCase() && invitation.status === 'active'
              ? { ...invitation, status: 'revoked' as const }
              : invitation,
          ),
        ],
      };
    case 'REVOKE_CIRCLE_INVITATION':
      if (state.community.role !== 'admin') return state;
      return {
        ...state,
        circleInvitations: state.circleInvitations.map((invitation) =>
          invitation.id === action.invitationId && invitation.status === 'active'
            ? { ...invitation, status: 'revoked' }
            : invitation,
        ),
      };
    case 'APPROVE_CIRCLE_JOIN_REQUEST': {
      if (state.community.role !== 'admin') return state;
      const request = state.circleJoinRequests.find((candidate) => candidate.id === action.requestId);
      if (!request || request.status !== 'pending') return state;
      return {
        ...state,
        community: { ...state.community, memberCount: state.community.memberCount + 1 },
        circleJoinRequests: state.circleJoinRequests.map((candidate) =>
          candidate.id === action.requestId ? { ...candidate, status: 'approved' } : candidate,
        ),
        circleMembers: [action.member, ...state.circleMembers],
      };
    }
    case 'DECLINE_CIRCLE_JOIN_REQUEST':
      if (state.community.role !== 'admin' || action.reason.trim().length < 3) return state;
      return {
        ...state,
        circleJoinRequests: state.circleJoinRequests.map((request) =>
          request.id === action.requestId && request.status === 'pending'
            ? { ...request, status: 'declined', declineReason: action.reason.trim() }
            : request,
        ),
      };
    case 'SET_CIRCLE_MEMBER_STATUS':
      if (state.community.role !== 'admin') return state;
      return {
        ...state,
        circleMembers: state.circleMembers.map((member) =>
          member.id === action.memberId && member.role !== 'admin'
            ? { ...member, status: action.status }
            : member,
        ),
      };
    case 'RESET_DEMO':
      return action.state;
    default:
      return state;
  }
}
