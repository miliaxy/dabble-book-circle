import { Link } from 'react-router-dom';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label="Dabble Book Circle home">
      <span className="brand-word">
        da<span>bb</span>le
      </span>
      {!compact && <>
        <span className="brand-divider" aria-hidden="true" />
        <span className="brand-product-lockup">
          <span className="brand-product">Book Circle</span>
          <sup className="brand-pilot">Pilot</sup>
        </span>
      </>}
    </Link>
  );
}
