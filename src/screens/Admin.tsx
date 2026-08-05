import { type FormEvent, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { formatDateIST } from '../domain';
import { newId, useApp } from '../state';
import type { CircleInvitation, CircleInvitationStatus, CircleJoinRequest } from '../types';

export function Admin() {
  const { state, dispatch } = useApp();
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [decliningRequest, setDecliningRequest] = useState<CircleJoinRequest | null>(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const pendingRequests = state.circleJoinRequests.filter((request) => request.status === 'pending');
  const activeLoans = state.loans.filter((loan) => !['completed', 'feedback_pending'].includes(loan.status)).length;
  const listedBooks = state.books.length;
  const invitations = useMemo(
    () => [...state.circleInvitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.circleInvitations],
  );

  function approveRequest(request: CircleJoinRequest) {
    dispatch({
      type: 'APPROVE_CIRCLE_JOIN_REQUEST',
      requestId: request.id,
      member: {
        id: newId('family'),
        parentName: request.parentName,
        familyName: request.familyName,
        email: request.email,
        role: 'member',
        status: 'active',
        joinedAt: new Date().toISOString(),
        booksListed: 0,
        completedLoans: 0,
      },
    });
  }

  async function copyInvitation(invitation: CircleInvitation) {
    try {
      await navigator.clipboard.writeText(invitation.code);
      setCopiedInvitationId(invitation.id);
    } catch {
      setCopiedInvitationId(null);
    }
  }

  return (
    <div className="screen admin-screen">
      <header className="screen-heading action-heading">
        <div><h1>Manage your circle</h1><p>Invite families, review access requests and keep {state.community.name} trusted.</p></div>
        <button className="button button-primary" type="button" onClick={() => setCreatingInvitation(true)}>＋ Create invitation</button>
      </header>

      <section className="admin-circle-strip" aria-label="Circle being managed">
        <span aria-hidden="true">📖</span>
        <div><small>Current circle</small><strong>{state.community.name}</strong><p>{state.community.location} · Invite only</p></div>
        <span className="admin-status-dot">Pilot active</span>
      </section>

      <section className="admin-metric-grid" aria-label="Circle overview">
        <article><span className="summary-icon summary-teal">⌂</span><div><strong>{state.community.memberCount}</strong><small>Approved families</small></div></article>
        <article><span className="summary-icon summary-purple">▤</span><div><strong>{listedBooks}</strong><small>Books listed</small></div></article>
        <article><span className="summary-icon summary-amber">⇄</span><div><strong>{activeLoans}</strong><small>Active loans</small></div></article>
        <article><span className="summary-icon summary-coral">!</span><div><strong>{pendingRequests.length}</strong><small>Access requests</small></div></article>
      </section>

      <section className="admin-section admin-attention-section">
        <div className="section-heading"><div><h2>Needs your review</h2><p>Approve only families whose connection to this circle you can verify.</p></div><span className="admin-section-count">{pendingRequests.length} pending</span></div>
        {pendingRequests.length > 0 ? <div className="admin-request-list">{pendingRequests.map((request) => (
          <article className="admin-request-row" key={request.id}>
            <span className="admin-family-avatar">{request.parentName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
            <div className="admin-request-copy"><strong>{request.parentName}</strong><span>{request.familyName} · {request.email}</span><p>{request.connectionNote}</p><small>Requested {formatDateIST(request.requestedAt)}</small></div>
            <div className="admin-row-actions"><button className="button button-primary button-small" type="button" onClick={() => approveRequest(request)}>Approve</button><button className="button button-quiet button-small" type="button" onClick={() => setDecliningRequest(request)}>Decline</button></div>
          </article>
        ))}</div> : <div className="admin-empty-row"><span>✓</span><div><strong>No access requests waiting</strong><p>New requests will appear here for verification.</p></div></div>}
      </section>

      <div className="admin-columns">
        <section className="admin-section">
          <div className="section-heading"><div><h2>Invitations</h2><p>Single-use codes bound to one parent email.</p></div><button className="button button-quiet button-small" type="button" onClick={() => setCreatingInvitation(true)}>New invitation</button></div>
          <div className="admin-invitation-list">{invitations.map((invitation) => {
            const status = invitationStatus(invitation);
            return <article className="admin-invitation-row" key={invitation.id}><div><strong>{invitation.recipientEmail}</strong><span>{invitation.code}</span><small>Issued {formatDateIST(invitation.createdAt)} · Expires {formatDateIST(invitation.expiresAt)}</small></div><div className="admin-invitation-meta"><span className={`admin-status admin-status-${status}`}>{status}</span>{status === 'active' && <span className="admin-inline-actions"><button type="button" onClick={() => void copyInvitation(invitation)}>{copiedInvitationId === invitation.id ? 'Copied' : 'Copy code'}</button><button className="admin-revoke-link" type="button" onClick={() => dispatch({ type: 'REVOKE_CIRCLE_INVITATION', invitationId: invitation.id })}>Revoke</button></span>}</div></article>;
          })}</div>
        </section>

        <section className="admin-section">
          <div className="section-heading"><div><h2>Recent members</h2><p>Manage family access to this circle.</p></div><span className="admin-section-count">{state.community.memberCount} total</span></div>
          <div className="admin-member-list">{state.circleMembers.map((member) => (
            <article className="admin-member-row" key={member.id}>
              <span className="admin-family-avatar admin-family-avatar-small">{member.parentName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
              <div><strong>{member.familyName}</strong><span>{member.parentName} · {member.email}</span><small>{member.booksListed} {member.booksListed === 1 ? 'book' : 'books'} · {member.completedLoans} completed {member.completedLoans === 1 ? 'loan' : 'loans'}</small></div>
              <div className="admin-member-meta"><span className={`admin-status admin-status-${member.status}`}>{member.role === 'admin' ? 'Admin' : member.status}</span>{member.role !== 'admin' && <button type="button" onClick={() => dispatch({ type: 'SET_CIRCLE_MEMBER_STATUS', memberId: member.id, status: member.status === 'active' ? 'suspended' : 'active' })}>{member.status === 'active' ? 'Suspend' : 'Reinstate'}</button>}</div>
            </article>
          ))}</div>
        </section>
      </div>

      {creatingInvitation && <CreateInvitation onClose={() => setCreatingInvitation(false)} />}
      {decliningRequest && <DeclineJoinRequest request={decliningRequest} onClose={() => setDecliningRequest(null)} onConfirm={(reason) => { dispatch({ type: 'DECLINE_CIRCLE_JOIN_REQUEST', requestId: decliningRequest.id, reason }); setDecliningRequest(null); }} />}
    </div>
  );
}

function invitationStatus(invitation: CircleInvitation): CircleInvitationStatus {
  if (invitation.status === 'active' && new Date(invitation.expiresAt).getTime() < Date.now()) return 'expired';
  return invitation.status;
}

function CreateInvitation({ onClose }: { onClose: () => void }) {
  const { dispatch } = useApp();
  const [email, setEmail] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const now = new Date();
    const code = `GFC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    dispatch({ type: 'CREATE_CIRCLE_INVITATION', invitation: { id: newId('invite'), recipientEmail: cleanEmail, code, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString(), status: 'active' } });
    onClose();
  }

  return (
    <Modal title="Create circle invitation" onClose={onClose}>
      <form className="admin-invitation-form" onSubmit={submit}>
        <div className="admin-form-icon" aria-hidden="true">✉</div>
        <h3>Invite one parent</h3>
        <p>The code will be single use and will work only with this email address.</p>
        <label>Parent email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="parent@example.com" autoComplete="email" required /></label>
        <label>Invitation expires<select value={expiryDays} onChange={(event) => setExpiryDays(event.target.value)}><option value="3">In 3 days</option><option value="7">In 7 days</option><option value="14">In 14 days</option></select></label>
        <div className="admin-invite-note"><span aria-hidden="true">🔒</span><p>Creating a new invitation for the same email will revoke its previous unused code.</p></div>
        <div className="form-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">Create invitation</button></div>
      </form>
    </Modal>
  );
}

function DeclineJoinRequest({ request, onClose, onConfirm }: { request: CircleJoinRequest; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) return;
    onConfirm(reason.trim());
  }

  return (
    <Modal title="Decline access request?" onClose={onClose}>
      <form className="admin-decline-form" onSubmit={submit}>
        <div className="admin-form-icon admin-form-icon-decline" aria-hidden="true">↩</div>
        <h3>Decline {request.familyName}?</h3>
        <p>Share a short reason with {request.parentName}. This does not prevent an administrator from inviting them later.</p>
        <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} minLength={3} maxLength={180} placeholder="For example: We could not verify your connection to this circle yet." required /></label>
        <div className="form-actions"><button className="button button-quiet" type="button" onClick={onClose}>Keep request</button><button className="button button-danger" type="submit" disabled={reason.trim().length < 3}>Decline and send reason</button></div>
      </form>
    </Modal>
  );
}
