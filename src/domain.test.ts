import { describe, expect, it } from 'vitest';
import { createDemoState } from './data';
import {
  activeLoanForBook,
  addSevenDays,
  appReducer,
  displayStatus,
  queuePosition,
  waitingRequestsForBook,
} from './domain';

const NOW = new Date('2026-08-05T12:00:00.000Z');

describe('borrowing rules', () => {
  it('keeps the preview counts backed by complete member and borrowing records', () => {
    const state = createDemoState(NOW);
    const completedBorrowing = state.loans.filter((loan) =>
      loan.borrowerFamilyId === state.family.id && loan.status === 'completed');

    expect(state.version).toBe(4);
    expect(state.circleMembers).toHaveLength(state.community.memberCount);
    expect(completedBorrowing).toHaveLength(state.family.successfulLoans);
    expect(completedBorrowing.every((loan) =>
      state.books.some((book) => book.id === loan.bookId)
      && Boolean(loan.borrowerMarkedReturnedAt)
      && Boolean(loan.lenderConfirmedReturnedAt))).toBe(true);
  });

  it('calculates a family queue position by request time', () => {
    const state = createDemoState(NOW);
    expect(queuePosition(state.requests, 'request-gruffalo-current')).toBe(2);
  });

  it('starts the seven-day period only after receipt confirmation', () => {
    const state = createDemoState(NOW);
    const pendingLoan = {
      ...state.loans[0],
      status: 'awaiting_receipt' as const,
      dueAt: undefined,
    };
    const pendingState = { ...state, loans: [pendingLoan, ...state.loans.slice(1)] };
    const receiptTime = '2026-08-05T13:30:00.000Z';
    const next = appReducer(pendingState, {
      type: 'CONFIRM_RECEIVED',
      loanId: pendingLoan.id,
      now: receiptTime,
    });

    expect(next.loans[0].status).toBe('borrowed');
    expect(next.loans[0].dueAt).toBe(addSevenDays(receiptTime));
  });

  it('requires the lender confirmation before a returned book is available', () => {
    const state = createDemoState(NOW);
    const book = state.books.find((candidate) => candidate.id === 'book-krishna')!;
    const borrowerMarked = appReducer(state, {
      type: 'MARK_RETURNED',
      loanId: 'loan-krishna',
      now: NOW.toISOString(),
    });

    expect(displayStatus(book, borrowerMarked.requests, borrowerMarked.loans)).toBe('borrowed');

    const lenderConfirmed = appReducer(borrowerMarked, {
      type: 'CONFIRM_RETURN',
      loanId: 'loan-krishna',
      now: NOW.toISOString(),
    });
    expect(activeLoanForBook(lenderConfirmed.loans, book.id)).toBeUndefined();
    expect(displayStatus(book, lenderConfirmed.requests, lenderConfirmed.loans)).toBe('available');
  });

  it('accepts the first waiting request and creates a handover loan', () => {
    const state = createDemoState(NOW);
    const next = appReducer(state, {
      type: 'ACCEPT_NEXT_REQUEST',
      bookId: 'book-matilda',
      loanId: 'loan-new',
      now: NOW.toISOString(),
    });

    expect(next.requests.find((request) => request.id === 'request-matilda')?.status).toBe(
      'accepted',
    );
    expect(next.loans[0]).toMatchObject({
      id: 'loan-new',
      borrowerFamilyId: 'family-malhotra',
      status: 'handover_ready',
    });
  });

  it('lets the book owner decline a waiting request and advances the queue', () => {
    const state = createDemoState(NOW);
    const first = state.requests.find((request) => request.id === 'request-matilda')!;
    const second = {
      ...first,
      id: 'request-matilda-second',
      borrowerFamilyId: 'family-bose',
      borrowerName: 'Bose family',
      requestedAt: '2026-08-05T11:00:00.000Z',
    };
    const queuedState = { ...state, requests: [...state.requests, second] };
    const next = appReducer(queuedState, {
      type: 'DECLINE_REQUEST',
      requestId: first.id,
      reason: 'Book temporarily unavailable',
      now: NOW.toISOString(),
    });

    expect(next.requests.find((request) => request.id === first.id)).toMatchObject({
      status: 'declined',
      declinedAt: NOW.toISOString(),
      declineReason: 'Book temporarily unavailable',
    });
    expect(waitingRequestsForBook(next.requests, 'book-matilda')[0].id).toBe(second.id);
  });

  it('requires a reason before declining a request', () => {
    const state = createDemoState(NOW);
    const next = appReducer(state, {
      type: 'DECLINE_REQUEST',
      requestId: 'request-matilda',
      reason: '  ',
      now: NOW.toISOString(),
    });

    expect(next).toBe(state);
  });

  it('reissues an email-bound circle invitation and revokes the previous code', () => {
    const state = createDemoState(NOW);
    const next = appReducer(state, {
      type: 'CREATE_CIRCLE_INVITATION',
      invitation: {
        id: 'invite-new',
        recipientEmail: 'meera.sethi@example.test',
        code: 'GFC-NEW123',
        createdAt: NOW.toISOString(),
        expiresAt: addSevenDays(NOW.toISOString()),
        status: 'active',
      },
    });

    expect(next.circleInvitations[0]).toMatchObject({ id: 'invite-new', status: 'active' });
    expect(next.circleInvitations.find((invitation) => invitation.id === 'invite-meera')?.status).toBe('revoked');
  });

  it('approves a pending circle request and adds the family as a member', () => {
    const state = createDemoState(NOW);
    const request = state.circleJoinRequests[0];
    const next = appReducer(state, {
      type: 'APPROVE_CIRCLE_JOIN_REQUEST',
      requestId: request.id,
      member: {
        id: 'family-new',
        parentName: request.parentName,
        familyName: request.familyName,
        email: request.email,
        role: 'member',
        status: 'active',
        joinedAt: NOW.toISOString(),
        booksListed: 0,
        completedLoans: 0,
      },
    });

    expect(next.circleJoinRequests.find((candidate) => candidate.id === request.id)?.status).toBe('approved');
    expect(next.circleMembers[0].id).toBe('family-new');
    expect(next.community.memberCount).toBe(state.community.memberCount + 1);
  });

  it('does not allow a non-admin member to change circle membership', () => {
    const state = createDemoState(NOW);
    const memberState = { ...state, community: { ...state.community, role: 'member' as const } };
    const next = appReducer(memberState, {
      type: 'SET_CIRCLE_MEMBER_STATUS',
      memberId: 'family-bedi',
      status: 'active',
    });

    expect(next).toBe(memberState);
  });
});
