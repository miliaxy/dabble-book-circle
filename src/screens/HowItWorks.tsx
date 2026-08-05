import { Link } from 'react-router-dom';
import { PublicFooter } from '../components/PublicFooter';
import { PublicHeader } from '../components/PublicHeader';
import { useApp } from '../state';

export function HowItWorks() {
  const { state } = useApp();

  return (
    <div className="public-page how-page">
      <PublicHeader />

      <main>
        <section className="how-page-hero">
          <span className="page-kicker">How Dabble Book Circle works</span>
          <h1>From your bookshelf to another family in three simple steps.</h1>
          <p>A clear, parent-managed borrowing flow keeps every book and every handover easy to follow.</p>
        </section>

        <section className="how-grid how-page-steps" aria-label="Three borrowing steps">
          <article><span className="step-number">1</span><div className="step-icon">📸</div><h2>Photograph a book</h2><p>Take a cover photo, review the suggested title and author, and choose whether it can be borrowed.</p></article>
          <article><span className="step-number">2</span><div className="step-icon">☝️</div><h2>Request or join the queue</h2><p>Available books can be requested immediately. Additional families keep their place in a fair queue.</p></article>
          <article><span className="step-number">3</span><div className="step-icon">↩️</div><h2>Borrow and return</h2><p>The seven days begin when the borrower confirms receipt. Both families confirm the return.</p></article>
        </section>

        <section className="borrowing-rules">
          <div className="rules-heading">
            <span className="page-kicker">The borrowing mechanics</span>
            <h2>Simple rules everyone can understand.</h2>
          </div>
          <div className="rules-grid">
            <article><strong>Fair queue</strong><p>Requests stay in the order they were made.</p></article>
            <article><strong>Seven days</strong><p>The loan starts only after the borrower confirms receipt.</p></article>
            <article><strong>Two confirmations</strong><p>The borrower marks returned; the lender confirms it is back.</p></article>
            <article><strong>Family reliability</strong><p>Timeliness and book condition build a household-level record.</p></article>
          </div>
        </section>

        <section className="how-page-cta">
          <div><strong>Ready to see what your circle is sharing?</strong><p>Use the private invitation sent by your circle administrator.</p></div>
          <Link className="button button-primary" to={state.signedIn ? '/library' : '/join'}>
            {state.signedIn ? 'Browse your circle' : 'Join Book Circle'} <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
