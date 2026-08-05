export type DbAgeBand = 'age_3_5' | 'age_6_8' | 'age_9_12' | 'age_13_plus';
export type DbBookCategory =
  | 'picture_book'
  | 'early_reader'
  | 'chapter_book'
  | 'comic_graphic_novel'
  | 'mythology'
  | 'science_nature'
  | 'general_knowledge';
export type DbBookLanguage = 'english' | 'hindi' | 'bilingual' | 'other';
export type DbBookCondition = 'like_new' | 'good' | 'well_loved';
export type DbReturnCondition =
  | 'same_condition'
  | 'minor_additional_wear'
  | 'material_damage';

export type CirculationStatus = 'available' | 'queued' | 'reserved' | 'borrowed' | 'paused';

export interface CircleBookRecord {
  listing_id: string;
  book_copy_id: string;
  book_title_id: string;
  title: string;
  author: string;
  description: string;
  isbn_normalized: string | null;
  goodreads_url: string | null;
  owner_family_id: string;
  owner_display_name: string;
  age_band: DbAgeBand;
  category: DbBookCategory;
  language: DbBookLanguage;
  condition: DbBookCondition;
  photo_path: string | null;
  is_lendable: boolean;
  circulation_status: CirculationStatus;
  waiting_count: number;
  listed_at: string;
}

export interface CreateBookListingInput {
  communityId: string;
  title: string;
  author?: string;
  description?: string;
  isbn?: string;
  goodreadsUrl?: string;
  metadataSource: 'parent' | 'google_books' | 'open_library';
  ageBand: DbAgeBand;
  category: DbBookCategory;
  language: DbBookLanguage;
  condition: DbBookCondition;
  photoPath?: string;
}

export interface CreatedBookListing {
  book_copy_id: string;
  listing_id: string;
}

export interface QueueRequestResult {
  request_id: string;
  queue_position: number;
}

export interface HandoverContact {
  counterpart_family_name: string;
  whatsapp_e164: string | null;
}

export interface FamilyReliability {
  completed_loans: number;
  on_time_returns: number;
  good_condition_returns: number;
}

export type LoanStatus =
  | 'handover_ready'
  | 'awaiting_receipt'
  | 'borrowed'
  | 'return_pending'
  | 'feedback_pending'
  | 'completed'
  | 'cancelled';

export interface LoanRecord {
  id: string;
  request_id: string;
  listing_id: string;
  book_copy_id: string;
  community_id: string;
  lender_family_id: string;
  borrower_family_id: string;
  status: LoanStatus;
  accepted_at: string;
  handed_over_at: string | null;
  received_at: string | null;
  due_at: string | null;
  borrower_marked_returned_at: string | null;
  lender_confirmed_returned_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
}

export interface BorrowRequestRecord {
  id: string;
  listing_id: string;
  book_copy_id: string;
  borrower_family_id: string;
  status: 'waiting' | 'accepted' | 'cancelled' | 'declined' | 'expired';
  requested_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  declined_at: string | null;
  declined_by_family_id: string | null;
  decline_reason: string | null;
}

export interface BookCircleBackend {
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  bootstrapParent(input: {
    fullName: string;
    familyDisplayName: string;
    whatsappE164?: string;
  }): Promise<string>;
  redeemInvitation(token: string): Promise<string>;
  listCircleBooks(communityId: string): Promise<CircleBookRecord[]>;
  createBookListing(input: CreateBookListingInput): Promise<CreatedBookListing>;
  requestBook(listingId: string): Promise<QueueRequestResult>;
  cancelBookRequest(requestId: string): Promise<void>;
  declineBookRequest(requestId: string, reason: string): Promise<void>;
  acceptNextRequest(listingId: string): Promise<string>;
  markBookHandedOver(loanId: string): Promise<void>;
  confirmBookReceived(loanId: string): Promise<string>;
  markBookReturned(loanId: string): Promise<void>;
  confirmBookReturned(loanId: string): Promise<void>;
  submitLoanFeedback(
    loanId: string,
    condition: DbReturnCondition,
    privateNote?: string,
  ): Promise<void>;
}
