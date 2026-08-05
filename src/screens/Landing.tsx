import { Link } from 'react-router-dom';
import { PublicFooter } from '../components/PublicFooter';
import { PublicHeader } from '../components/PublicHeader';
import { useApp } from '../state';

export function Landing() {
  const { state } = useApp();
  return (
    <div className="public-page">
      <PublicHeader />

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <h1>Great books deserve <em>another reader.</em></h1>
            <p>
              Share children’s books with families you know, and discover what other readers in
              your circle are ready to lend.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to={state.signedIn ? '/library' : '/join'}>
                {state.signedIn ? 'Browse your circle' : 'Join Book Circle'} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="hero-visual" aria-label="A selection of books shared in a private circle">
            <div className="hero-circle hero-circle-one" />
            <div className="hero-circle hero-circle-two" />
            <div className="book-fan">
              <article className="fan-book fan-book-one">
                <span>🌿</span><strong>The Wild<br />Robot</strong><small>Peter Brown</small>
              </article>
              <article className="fan-book fan-book-two">
                <span>🪈</span><strong>Stories of<br />Krishna</strong><small>Indian mythology</small>
              </article>
              <article className="fan-book fan-book-three">
                <span>🐭</span><strong>A walk in<br />the woods</strong><small>Picture book</small>
              </article>
            </div>
            <div className="floating-note floating-note-top"><span>✓</span> Returned on time</div>
            <div className="floating-note floating-note-bottom"><span>↗</span> 42 books shared</div>
          </div>
        </section>

        <section className="landing-principles">
          <article><span aria-hidden="true">🔒</span><div><strong>Your book circles</strong><p>A circle is a private community of families sharing books. Join one or more by invitation.</p></div></article>
          <article><span aria-hidden="true">📷</span><div><strong>Photo-first listing</strong><p>Start with the cover; confirm the suggested details.</p></div></article>
          <article><span aria-hidden="true">↩️</span><div><strong>Simple borrowing</strong><p>Fair queues, seven-day loans and returns confirmed by both families.</p></div></article>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
