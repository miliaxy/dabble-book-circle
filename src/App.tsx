import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useApp } from './state';
import { Access } from './screens/Access';
import { Account } from './screens/Account';
import { Admin } from './screens/Admin';
import { Browse } from './screens/Browse';
import { Contact } from './screens/Contact';
import { HowItWorks } from './screens/HowItWorks';
import { Landing } from './screens/Landing';
import { Loans } from './screens/Loans';
import { MyBooks } from './screens/MyBooks';

function ProtectedApp() {
  const { state } = useApp();
  return state.signedIn ? <AppShell /> : <Navigate to="/sign-in" replace />;
}

function AdminOnly() {
  const { state } = useApp();
  return state.community.role === 'admin' ? <Admin /> : <Navigate to="/library" replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/join" element={<Access mode="join" />} />
        <Route path="/sign-in" element={<Access mode="sign-in" />} />
        <Route element={<ProtectedApp />}>
          <Route path="/library" element={<Browse />} />
          <Route path="/my-books" element={<MyBooks />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<AdminOnly />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
