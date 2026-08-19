export type AgeBand = '3–5' | '6–8' | '9–12' | '13+';
export type BookCategory =
  | 'Picture book'
  | 'Early reader'
  | 'Chapter book'
  | 'Comic & graphic novel'
  | 'Mythology'
  | 'Science & nature'
  | 'General knowledge';
export type BookCondition = 'Like new' | 'Good' | 'Well loved';
export type BookLanguage = 'English' | 'Hindi' | 'Bilingual';

export interface Family {
  id: string;
  parentName: string;
  displayName: string;
  email: string;
  whatsapp: string;
  successfulLoans: number;
  onTimeLoans: number;
}

export interface Community {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  role: 'admin' | 'member';
}

export interface BookCopy {
  id: string;
  title: string;
  author: string;
  description: string;
  ownerFamilyId: string;
  ownerName: string;
  ageBand: AgeBand;
  category: BookCategory;
  language: BookLanguage;
  condition: BookCondition;
  available: boolean;
  coverImage?: string;
  coverEmoji: string;
  coverStyle: string;
  isbn?: string;
  seriesName?: string;
  seriesNumber?: string;
  goodreadsUrl?: string;
  createdAt: string;
}

export type RequestStatus = 'waiting' | 'accepted' | 'cancelled' | 'declined';

export interface BorrowRequest {
  id: string;
  bookId: string;
  borrowerFamilyId: string;
  borrowerName: string;
  requestedAt: string;
  status: RequestStatus;
  declinedAt?: string;
  declineReason?: string;
}

export type LoanStatus =
  | 'handover_ready'
  | 'awaiting_receipt'
  | 'borrowed'
  | 'return_pending'
  | 'feedback_pending'
  | 'completed';

export interface Loan {
  id: string;
  bookId: string;
  lenderFamilyId: string;
  lenderName: string;
  borrowerFamilyId: string;
  borrowerName: string;
  status: LoanStatus;
  acceptedAt: string;
  handedOverAt?: string;
  receivedAt?: string;
  dueAt?: string;
  borrowerMarkedReturnedAt?: string;
  lenderConfirmedReturnedAt?: string;
}

export interface LoanFeedback {
  loanId: string;
  onTime: boolean;
  condition: 'Same condition' | 'Minor additional wear' | 'Material damage';
  privateNote?: string;
}

export interface Preferences {
  shareWhatsappDuringHandover: boolean;
  emailReminders: boolean;
}

export type CircleInvitationStatus = 'active' | 'redeemed' | 'revoked' | 'expired';

export interface CircleInvitation {
  id: string;
  recipientEmail: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  status: CircleInvitationStatus;
}

export interface CircleMember {
  id: string;
  parentName: string;
  familyName: string;
  email: string;
  role: 'admin' | 'member';
  status: 'active' | 'suspended';
  joinedAt: string;
  booksListed: number;
  completedLoans: number;
}

export interface CircleJoinRequest {
  id: string;
  parentName: string;
  familyName: string;
  email: string;
  connectionNote: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'declined';
  declineReason?: string;
}

export interface AppState {
  version: number;
  signedIn: boolean;
  family: Family;
  community: Community;
  books: BookCopy[];
  requests: BorrowRequest[];
  loans: Loan[];
  feedback: LoanFeedback[];
  preferences: Preferences;
  circleInvitations: CircleInvitation[];
  circleMembers: CircleMember[];
  circleJoinRequests: CircleJoinRequest[];
}

export type AppAction =
  | { type: 'SIGN_IN' }
  | { type: 'SIGN_OUT' }
  | { type: 'ADD_BOOK'; book: BookCopy }
  | { type: 'TOGGLE_BOOK'; bookId: string }
  | { type: 'REQUEST_BOOK'; request: BorrowRequest }
  | { type: 'CANCEL_REQUEST'; requestId: string }
  | { type: 'DECLINE_REQUEST'; requestId: string; reason: string; now: string }
  | { type: 'ACCEPT_NEXT_REQUEST'; bookId: string; loanId: string; now: string }
  | { type: 'MARK_HANDED_OVER'; loanId: string; now: string }
  | { type: 'CONFIRM_RECEIVED'; loanId: string; now: string }
  | { type: 'MARK_RETURNED'; loanId: string; now: string }
  | { type: 'CONFIRM_RETURN'; loanId: string; now: string }
  | { type: 'SUBMIT_FEEDBACK'; feedback: LoanFeedback }
  | { type: 'SET_WHATSAPP_SHARING'; enabled: boolean }
  | { type: 'SET_EMAIL_REMINDERS'; enabled: boolean }
  | { type: 'CREATE_CIRCLE_INVITATION'; invitation: CircleInvitation }
  | { type: 'REVOKE_CIRCLE_INVITATION'; invitationId: string }
  | { type: 'APPROVE_CIRCLE_JOIN_REQUEST'; requestId: string; member: CircleMember }
  | { type: 'DECLINE_CIRCLE_JOIN_REQUEST'; requestId: string; reason: string }
  | { type: 'SET_CIRCLE_MEMBER_STATUS'; memberId: string; status: CircleMember['status'] }
  | { type: 'RESET_DEMO'; state: AppState };

export type BookDisplayStatus = 'available' | 'queued' | 'reserved' | 'borrowed' | 'paused';
