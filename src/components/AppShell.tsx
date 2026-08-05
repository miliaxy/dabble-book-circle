import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../state';
import { Logo } from './Logo';
import { PublicFooter } from './PublicFooter';

const navigation = [
  { to: '/library', icon: '⌕', label: 'Browse' },
  { to: '/my-books', icon: '▤', label: 'My Books' },
  { to: '/loans', icon: '⇄', label: 'Loans' },
  { to: '/account', icon: '○', label: 'Account' },
];
const adminNavigation = { to: '/admin', icon: '⚙', label: 'Admin' };

export function AppShell() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const visibleNavigation = state.community.role === 'admin' ? [...navigation, adminNavigation] : navigation;

  function signOut() {
    dispatch({ type: 'SIGN_OUT' });
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Logo />
        <div className="circle-mini-card">
          <span className="circle-mini-icon" aria-hidden="true">📖</span>
          <div>
            <small>Your circle</small>
            <strong>{state.community.name}</strong>
            <span className="circle-member-count">{state.community.memberCount} families</span>
          </div>
        </div>
        <nav className="desktop-nav" aria-label="Book Circle navigation">
          {visibleNavigation.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-column">
        <header className="app-utility-header">
          <button className="app-signout-button" type="button" onClick={signOut}>Sign out</button>
        </header>
        <header className="mobile-header">
          <Logo />
          <button className="app-signout-button" type="button" onClick={signOut}>Sign out</button>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
        <PublicFooter />
        <nav className={`bottom-nav${state.community.role === 'admin' ? ' admin-nav' : ''}`} aria-label="Book Circle navigation">
          {visibleNavigation.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
