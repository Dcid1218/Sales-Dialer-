import { QUACKED, PLATFORM_BRAND } from '../lib/brand.ts';
import type { Brand } from '../lib/core.ts';

export function BrandMark({
  brand,
  size = 40,
  className = '',
}: {
  brand?: Brand | null;
  size?: number;
  className?: string;
}) {
  const src = brand?.logoUrl || PLATFORM_BRAND.logoUrl || QUACKED.logoUrl;
  const label = brand?.logoText || brand?.appName?.slice(0, 2) || 'QD';
  if (src) {
    return (
      <img
        className={`brand-mark ${className}`}
        src={src}
        alt={brand?.appName || 'QuackedDialer'}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className={`brand-mark fallback ${className}`} style={{ width: size, height: size, fontSize: size * 0.32 }}>
      {label}
    </div>
  );
}
