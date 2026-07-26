import { PLATFORM_BRAND, QUACKED } from '../lib/brand.ts';
import type { Brand } from '../lib/core.ts';

type Variant = 'app' | 'header' | 'hero' | 'tile' | 'inline';

const SIZE: Record<Variant, number> = {
  app: 40,
  header: 36,
  hero: 72,
  tile: 48,
  inline: 28,
};

/** Prefer processed square marks for platform logo; team custom urls still work. */
function resolveSrc(brand?: Brand | null, variant: Variant = 'app') {
  const custom = brand?.logoUrl;
  const isPlatform =
    !custom ||
    custom === PLATFORM_BRAND.logoUrl ||
    custom === QUACKED.logoUrl ||
    custom.includes('quacked-logo') ||
    custom.includes('quacked-mark');

  if (isPlatform) {
    if (variant === 'hero') return '/brand/quacked-mark-720.png';
    if (variant === 'tile' || variant === 'header') return '/brand/quacked-mark-192.png';
    if (variant === 'inline') return '/brand/quacked-mark-128.png';
    return '/brand/quacked-mark.png';
  }
  return custom;
}

export function BrandMark({
  brand,
  size,
  variant = 'app',
  className = '',
  label,
}: {
  brand?: Brand | null;
  size?: number;
  variant?: Variant;
  className?: string;
  label?: string;
}) {
  const px = size ?? SIZE[variant];
  const src = resolveSrc(brand, variant);
  const text = label || brand?.logoText || brand?.appName?.slice(0, 2) || 'QD';

  if (src) {
    return (
      <span
        className={`brand-mark brand-mark--${variant} ${className}`.trim()}
        style={{ width: px, height: px }}
        aria-hidden={false}
      >
        <img
          src={src}
          alt={brand?.appName || 'QuackedDialer'}
          width={px}
          height={px}
          decoding="async"
          loading={variant === 'hero' ? 'eager' : 'lazy'}
        />
      </span>
    );
  }

  return (
    <span
      className={`brand-mark brand-mark--${variant} fallback ${className}`.trim()}
      style={{ width: px, height: px, fontSize: Math.max(11, px * 0.34) }}
      aria-label={brand?.appName || 'QuackedDialer'}
    >
      {text}
    </span>
  );
}
