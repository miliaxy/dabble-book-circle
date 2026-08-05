import { useNavigate } from 'react-router-dom';
import { useApp } from '../state';

export function Account() {
  const { state, dispatch, resetDemo } = useApp();
  const navigate = useNavigate();
  const successRate = state.family.successfulLoans === 0 ? 0 : Math.round((state.family.onTimeLoans / state.family.successfulLoans) * 100);

  function reset() {
    if (window.confirm('Reset all preview books, requests and loan actions?')) {
      resetDemo();
      navigate('/');
    }
  }

  return (
    <div className="screen account-screen">
      <header className="screen-heading"><h1>Your account</h1><p>Manage your family details, borrowing record and preferences.</p></header>

      <section className="account-panel">
        <section className="account-record" aria-label="Family borrowing record">
          <div className="account-record-copy"><span>Family borrowing record</span><h2>Reliable circle member</h2><p>A private record based on completed loans and timely returns.</p></div>
          <div className="account-record-stats"><span><strong>{state.family.successfulLoans}</strong><small>Completed loans</small></span><span><strong>{state.family.onTimeLoans}</strong><small>On-time returns</small></span><span><strong>{successRate}%</strong><small>On-time rate</small></span></div>
        </section>

        <section className="account-profile-section">
          <span className="profile-avatar">PS</span>
          <div className="profile-copy"><h2>{state.family.parentName}</h2><p>{state.family.displayName}</p><span>{state.family.email}</span></div>
          <span className="verified-badge">✓ Invited parent</span>
        </section>

        <section className="account-section">
          <div className="account-section-heading"><h2>Preferences</h2><p>Choose how matched families contact you and when you receive reminders.</p></div>

          <div className="account-preference-row">
            <span className="settings-icon settings-icon-teal" aria-hidden="true">💬</span>
            <div><strong>Share WhatsApp during handover</strong><p>Only the matched lender or borrower can see it after a request is accepted.</p></div>
            <label className="toggle"><input aria-label="Share WhatsApp during handover" type="checkbox" checked={state.preferences.shareWhatsappDuringHandover} onChange={(event) => dispatch({ type: 'SET_WHATSAPP_SHARING', enabled: event.target.checked })} /><span /></label>
          </div>
          <div className="account-preference-detail"><div><small>Your saved WhatsApp</small><strong>{state.preferences.shareWhatsappDuringHandover ? '+91 90000 00000' : 'Sharing is off'}</strong></div><span>{state.preferences.shareWhatsappDuringHandover ? 'Matched families only' : 'Private'}</span></div>
          <p className="account-privacy-note"><span aria-hidden="true">🔒</span>Your number is never shown in the catalog, member list, queue or public pages.</p>

          <div className="account-preference-row account-reminder-row">
            <span className="settings-icon settings-icon-purple" aria-hidden="true">🔔</span>
            <div><strong>Email reminders</strong><p>Requests, handover confirmations and due-date reminders.</p></div>
            <label className="toggle"><input aria-label="Email reminders" type="checkbox" checked={state.preferences.emailReminders} onChange={(event) => dispatch({ type: 'SET_EMAIL_REMINDERS', enabled: event.target.checked })} /><span /></label>
          </div>
          <div className="notification-list"><span>2 days before return</span><span>On the due date</span><span>When a return needs confirmation</span></div>
        </section>

        <section className="account-section account-circle-section">
          <div className="circle-account-main"><span className="circle-account-icon">📖</span><div><small>Your circle</small><h2>{state.community.name}</h2><p>{state.community.location} · {state.community.memberCount} approved families</p></div></div>
          <span className="member-badge">{state.community.role === 'admin' ? 'Circle admin' : 'Member'}</span>
        </section>
      </section>

      <div className="account-actions"><button className="text-danger" type="button" onClick={reset}>Reset private preview</button></div>
    </div>
  );
}
