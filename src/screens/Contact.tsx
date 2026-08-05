import { PublicFooter } from '../components/PublicFooter';
import { PublicHeader } from '../components/PublicHeader';

const supportEmail = 'contactdabblenow@gmail.com';
const emailHref = `mailto:${supportEmail}?subject=${encodeURIComponent('Dabble Book Circle support')}`;

export function Contact() {
  return (
    <div className="public-page contact-page">
      <PublicHeader />

      <main className="contact-main">
        <section className="contact-hero">
          <span className="page-kicker">Contact Dabble Book Circle</span>
          <h1>Have a question or an issue?</h1>
          <p>We can help with invitations, book listings, borrowing, returns and account access.</p>
        </section>

        <section className="contact-support-card">
          <div className="contact-icon" aria-hidden="true">💬</div>
          <div className="contact-support-copy">
            <h2>Email Book Circle support</h2>
            <p>Tell us what happened and which part of Book Circle you were using. We’ll reply to the email address you contact us from.</p>
            <a className="contact-email" href={emailHref}>{supportEmail}</a>
          </div>
          <a className="button button-primary" href={emailHref}>Contact us <span aria-hidden="true">→</span></a>
        </section>

        <aside className="contact-privacy-note">
          <span aria-hidden="true">🔒</span>
          <div><strong>Keep support messages family-safe.</strong><p>Please include the book title and a short description of the issue, but do not send a child’s name, class, phone number or other unnecessary personal details.</p></div>
        </aside>
      </main>

      <PublicFooter />
    </div>
  );
}
