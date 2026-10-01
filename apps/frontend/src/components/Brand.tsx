import { Link } from 'react-router-dom';

/** Marca: palomita sobre fondo pino y la pastilla amarilla de lo recurrente */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="lc-brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="#1d5b45" />
      <path d="M8.5 16.8l4.7 4.6 9.3-9.6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="7.5" r="4.5" fill="#f6c945" stroke="#1d5b45" strokeWidth="2" />
    </svg>
  );
}

export function Brand({ to, className = '' }: { to?: string; className?: string }) {
  const content = (
    <>
      <BrandMark />
      <span>MyTaskLists</span>
    </>
  );
  return to ? (
    <Link className={`lc-brand ${className}`} to={to}>
      {content}
    </Link>
  ) : (
    <span className={`lc-brand ${className}`}>{content}</span>
  );
}
