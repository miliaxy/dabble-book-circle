import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { PublicFooter } from '../components/PublicFooter';
import { DEMO_INVITATION } from '../demoInvitation';
import { useApp } from '../state';

export function Access({ mode }: { mode: 'join' | 'sign-in' }) {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>(DEMO_INVITATION.recipientEmail);
  const [code, setCode] = useState<string>(mode === 'join' ? DEMO_INVITATION.code : '246810');
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.includes('@')) {
      setError('Enter a valid parent email.');
      return;
    }
    const validCode = mode === 'join' ? code.trim().toUpperCase() === DEMO_INVITATION.code : code.trim() === '246810';
    if (!validCode) {
      setError(mode === 'join' ? 'That invitation is not valid.' : 'That sign-in code is not valid.');
      return;
    }
    if (mode === 'join' && email.trim().toLowerCase() !== DEMO_INVITATION.recipientEmail) {
      setError(`This preview invitation was issued to ${DEMO_INVITATION.recipientEmail}.`);
      return;
    }
    dispatch({ type: 'SIGN_IN' });
    navigate('/library');
  }

  return (
    <div className="access-page">
      <header className="access-header"><Logo /></header>
      <main className="access-layout">
        <section className="access-copy">
          <span className="eyebrow">Dabble Book Circle</span>
          <h1>{mode === 'join' ? <>You’re invited to <em>{DEMO_INVITATION.circle.name}.</em></> : 'Welcome back.'}</h1>
          <p>{mode === 'join' ? 'A circle is a private community of families who can see and borrow each other’s books. Your family can join more than one.' : 'Sign in as a parent to manage your family’s books and loans.'}</p>
          <ul className="check-list">
            <li><span>✓</span> Invitations are tied to one parent email</li>
            <li><span>✓</span> Books stay inside your approved circle</li>
            <li><span>✓</span> Contact details appear only during handover</li>
          </ul>
        </section>
        <form className="access-card" onSubmit={submit}>
          <div className="access-card-icon" aria-hidden="true">{mode === 'join' ? '✉️' : '👋'}</div>
          <h2>{mode === 'join' ? 'Join Book Circle' : 'Parent sign in'}</h2>
          <p>{mode === 'join' ? 'Enter the single-use code sent by your circle administrator to this parent email.' : 'Enter the one-time code sent to your email.'}</p>
          {mode === 'join' && <div className="invitation-circle"><span aria-hidden="true">📚</span><div><small>Your invitation</small><strong>{DEMO_INVITATION.circle.name}</strong><p>{DEMO_INVITATION.circle.location} · Private community</p></div></div>}
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />{mode === 'join' && <small className="field-note">The invitation will work only with the email that received it.</small>}</label>
          <label>{mode === 'join' ? 'Invitation code' : 'Six-digit code'}<input value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="characters" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-full" type="submit">{mode === 'join' ? 'Join this circle' : 'Sign in'} <span aria-hidden="true">→</span></button>
          <aside className="preview-note"><strong>Private preview</strong><span>{mode === 'join' ? `Use ${DEMO_INVITATION.code}` : 'Use 246810'} to explore the fictional pilot.</span></aside>
          <p className="access-switch">{mode === 'join' ? <>Already joined? <Link to="/sign-in">Parent sign in</Link></> : <>Have an invitation? <Link to="/join">Join Book Circle</Link></>}</p>
        </form>
      </main>
      <PublicFooter />
    </div>
  );
}
