import { Link } from 'react-router-dom';
import { useApp } from '../state';
import { Logo } from './Logo';

export function PublicHeader() {
  const { state } = useApp();

  return (
    <header className="public-header">
      <Logo />
      <nav aria-label="Public navigation">
        <Link className="header-how-link" to="/how-it-works">How it works</Link>
        <Link className="button button-quiet button-small" to={state.signedIn ? '/library' : '/sign-in'}>
          {state.signedIn ? 'Open circle' : 'Sign in'}
        </Link>
      </nav>
    </header>
  );
}
