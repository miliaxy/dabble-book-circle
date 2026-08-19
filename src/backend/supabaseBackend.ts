import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BookCircleBackend,
  BorrowRequestRecord,
  CircleBookRecord,
  CreateBookListingInput,
  CreatedBookListing,
  DbReturnCondition,
  FamilyReliability,
  HandoverContact,
  LoanRecord,
  QueueRequestResult,
} from './contracts';
import type { BackendConfig } from './config';

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function firstRow<T>(data: unknown, operation: string): T {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${operation} did not return a result.`);
  }
  return data[0] as T;
}

function photoExtension(file: File) {
  switch (file.type) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    default: return 'jpg';
  }
}

export class SupabaseBookCircleBackend implements BookCircleBackend {
  constructor(private readonly client: SupabaseClient) {}

  async sendMagicLink(email: string) {
    const redirectBase = typeof window === 'undefined' ? '' : window.location.origin;
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectBase ? `${redirectBase}/books/library` : undefined,
      },
    });
    throwOnError(error);
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    throwOnError(error);
  }

  async bootstrapParent(input: {
    fullName: string;
    familyDisplayName: string;
    whatsappE164?: string;
  }) {
    const { data, error } = await this.client.rpc('bootstrap_parent', {
      p_full_name: input.fullName,
      p_family_display_name: input.familyDisplayName,
      p_whatsapp_e164: input.whatsappE164 ?? null,
    });
    throwOnError(error);
    if (typeof data !== 'string') throw new Error('Parent setup did not return a family ID.');
    return data;
  }

  async createInvitation(communityId: string, recipientEmail: string, expiresAt?: string) {
    const { data, error } = await this.client.rpc('create_circle_invitation', {
      p_community_id: communityId,
      p_recipient_email: recipientEmail,
      p_expires_at: expiresAt,
    });
    throwOnError(error);
    if (typeof data !== 'string') throw new Error('Invitation creation did not return a token.');
    return data;
  }

  async redeemInvitation(token: string) {
    const { data, error } = await this.client.rpc('redeem_circle_invitation', {
      p_token: token,
    });
    throwOnError(error);
    if (typeof data !== 'string') throw new Error('Invitation did not return a circle ID.');
    return data;
  }

  async listCircleBooks(communityId: string) {
    const { data, error } = await this.client.rpc('list_circle_books', {
      p_community_id: communityId,
    });
    throwOnError(error);
    return (data ?? []) as CircleBookRecord[];
  }

  async uploadBookPhoto(input: {
    communityId: string;
    familyId: string;
    file: File;
  }) {
    if (!input.file.type.startsWith('image/')) {
      throw new Error('Book photos must be image files.');
    }
    if (input.file.size > 5 * 1024 * 1024) {
      throw new Error('Book photos must be 5 MB or smaller.');
    }

    const path = `${input.communityId}/${input.familyId}/${crypto.randomUUID()}.${photoExtension(input.file)}`;
    const { error } = await this.client.storage
      .from('book-photos')
      .upload(path, input.file, { cacheControl: '3600', upsert: false });
    throwOnError(error);
    return path;
  }

  async createBookPhotoUrl(path: string, lifetimeSeconds = 600) {
    const { data, error } = await this.client.storage
      .from('book-photos')
      .createSignedUrl(path, Math.min(Math.max(lifetimeSeconds, 60), 3600));
    throwOnError(error);
    if (!data?.signedUrl) throw new Error('Could not create a private book-photo URL.');
    return data.signedUrl;
  }

  async createBookListing(input: CreateBookListingInput) {
    const { data, error } = await this.client.rpc('create_book_listing', {
      p_community_id: input.communityId,
      p_title: input.title,
      p_author: input.author ?? '',
      p_description: input.description ?? '',
      p_series_name: input.seriesName ?? '',
      p_series_number: input.seriesNumber ?? '',
      p_isbn: input.isbn ?? '',
      p_goodreads_url: input.goodreadsUrl ?? '',
      p_metadata_source: input.metadataSource,
      p_age_band: input.ageBand,
      p_category: input.category,
      p_language: input.language,
      p_condition: input.condition,
      p_photo_path: input.photoPath ?? null,
    });
    throwOnError(error);
    return firstRow<CreatedBookListing>(data, 'Book creation');
  }

  async attachBookPhoto(bookCopyId: string, photoPath: string) {
    const { error } = await this.client.rpc('attach_book_photo', {
      p_book_copy_id: bookCopyId,
      p_photo_path: photoPath,
    });
    throwOnError(error);
  }

  async setListingLendable(listingId: string, isLendable: boolean) {
    const { error } = await this.client.rpc('set_listing_lendable', {
      p_listing_id: listingId,
      p_is_lendable: isLendable,
    });
    throwOnError(error);
  }

  async requestBook(listingId: string) {
    const { data, error } = await this.client.rpc('request_book', {
      p_listing_id: listingId,
    });
    throwOnError(error);
    return firstRow<QueueRequestResult>(data, 'Book request');
  }

  async cancelBookRequest(requestId: string) {
    const { error } = await this.client.rpc('cancel_book_request', {
      p_request_id: requestId,
    });
    throwOnError(error);
  }

  async declineBookRequest(requestId: string, reason: string) {
    const { error } = await this.client.rpc('decline_book_request', {
      p_request_id: requestId,
      p_reason: reason,
    });
    throwOnError(error);
  }

  async acceptNextRequest(listingId: string) {
    const { data, error } = await this.client.rpc('accept_next_request', {
      p_listing_id: listingId,
    });
    throwOnError(error);
    if (typeof data !== 'string') throw new Error('Request acceptance did not return a loan ID.');
    return data;
  }

  async cancelLoanBeforeReceipt(loanId: string) {
    const { error } = await this.client.rpc('cancel_loan_before_receipt', {
      p_loan_id: loanId,
    });
    throwOnError(error);
  }

  async markBookHandedOver(loanId: string) {
    const { error } = await this.client.rpc('mark_book_handed_over', { p_loan_id: loanId });
    throwOnError(error);
  }

  async confirmBookReceived(loanId: string) {
    const { data, error } = await this.client.rpc('confirm_book_received', {
      p_loan_id: loanId,
    });
    throwOnError(error);
    if (typeof data !== 'string') throw new Error('Receipt confirmation did not return a due date.');
    return data;
  }

  async markBookReturned(loanId: string) {
    const { error } = await this.client.rpc('mark_book_returned', { p_loan_id: loanId });
    throwOnError(error);
  }

  async confirmBookReturned(loanId: string) {
    const { error } = await this.client.rpc('confirm_book_returned', { p_loan_id: loanId });
    throwOnError(error);
  }

  async submitLoanFeedback(
    loanId: string,
    condition: DbReturnCondition,
    privateNote?: string,
  ) {
    const { error } = await this.client.rpc('submit_loan_feedback', {
      p_loan_id: loanId,
      p_return_condition: condition,
      p_private_note: privateNote ?? null,
    });
    throwOnError(error);
  }

  async getQueuePosition(requestId: string) {
    const { data, error } = await this.client.rpc('get_queue_position', {
      p_request_id: requestId,
    });
    throwOnError(error);
    return typeof data === 'number' ? data : null;
  }

  async getHandoverContact(loanId: string) {
    const { data, error } = await this.client.rpc('get_handover_contact', {
      p_loan_id: loanId,
    });
    throwOnError(error);
    return Array.isArray(data) && data.length > 0 ? data[0] as HandoverContact : null;
  }

  async getFamilyReliability(familyId: string) {
    const { data, error } = await this.client.rpc('get_family_reliability', {
      p_family_id: familyId,
    });
    throwOnError(error);
    return firstRow<FamilyReliability>(data, 'Family reliability');
  }

  async listMyLoans(familyId: string) {
    const { data, error } = await this.client
      .from('loans')
      .select('*')
      .or(`lender_family_id.eq.${familyId},borrower_family_id.eq.${familyId}`)
      .order('updated_at', { ascending: false });
    throwOnError(error);
    return (data ?? []) as LoanRecord[];
  }

  async listMyRequests(familyId: string) {
    const { data, error } = await this.client
      .from('borrow_requests')
      .select('*')
      .eq('borrower_family_id', familyId)
      .order('requested_at', { ascending: false });
    throwOnError(error);
    return (data ?? []) as BorrowRequestRecord[];
  }

  async updateContactPreferences(input: {
    userId: string;
    fullName: string;
    whatsappE164: string | null;
    shareWhatsappDuringActiveLoan: boolean;
    emailReminders: boolean;
  }) {
    const { error } = await this.client
      .from('parent_profiles')
      .update({
        full_name: input.fullName,
        whatsapp_e164: input.whatsappE164,
        share_whatsapp_during_active_loan: input.shareWhatsappDuringActiveLoan,
        email_reminders: input.emailReminders,
      })
      .eq('user_id', input.userId);
    throwOnError(error);
  }
}

export function createSupabaseBookCircleBackend(config: BackendConfig) {
  if (config.mode !== 'supabase') {
    throw new Error('Supabase backend requested while the application is in preview mode.');
  }

  const client = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return new SupabaseBookCircleBackend(client);
}
