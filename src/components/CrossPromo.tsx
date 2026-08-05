export function CrossPromo({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`cross-promo${compact ? ' cross-promo-compact' : ''}`}>
      <span className="promo-icon" aria-hidden="true">✦</span>
      <div>
        <strong>Looking for kids’ activities in Gurgaon?</strong>
        {!compact && <p>Explore classes, camps, sports, music and more on Dabble.</p>}
      </div>
      <a href="https://dabblenow.com" rel="noreferrer">Explore activities <span aria-hidden="true">→</span></a>
    </aside>
  );
}
