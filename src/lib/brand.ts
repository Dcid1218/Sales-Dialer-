import type { Brand } from './core.ts';

/** QuackedDialer master palette from mallard Q mark */
export const QUACKED = {
  green: '#0B5C3B',
  greenDeep: '#074029',
  greenSoft: '#E6F2EB',
  greenMid: '#127A4E',
  gold: '#C4A35A',
  goldBright: '#D4B96A',
  goldSoft: '#F3EAD2',
  cream: '#F7F5F0',
  white: '#FFFFFF',
  ink: '#0A2F1F',
  muted: '#5C6F64',
  line: 'rgba(11, 92, 59, 0.14)',
  logoUrl: '/brand/quacked-logo.jpg',
};

export const PLATFORM_BRAND: Brand = {
  appName: 'QuackedDialer',
  tagline: 'Sales Performance OS',
  primary: QUACKED.gold,
  accent: QUACKED.greenMid,
  logoText: 'QD',
  logoUrl: QUACKED.logoUrl,
  theme: 'light',
  bg: QUACKED.cream,
};
