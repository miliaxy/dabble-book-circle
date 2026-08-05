import { Link } from 'react-router-dom';

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="public-footer">
        <p>Made with ❤️ by <strong>Dabble</strong> — Helping parents discover the best for their kids</p>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/how-it-works">How it works</Link>
          <span aria-hidden="true">·</span>
          <Link to="/contact">Contact us</Link>
          <span aria-hidden="true">·</span>
          <a href="https://dabblenow.com" rel="noreferrer">Kids’ activities in Gurgaon <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </footer>
  );
}
