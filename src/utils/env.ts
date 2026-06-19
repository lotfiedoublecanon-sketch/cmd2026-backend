// ============================================
// Safe environment helpers
// ============================================

const PLACEHOLDER_VALUES = [
  'COLLE_TA_VALEUR_ICI',
  'TON-BACKEND-PUBLIC-ICI',
  'YOUR_VALUE_HERE',
  'CHANGE_ME',
  'REPLACE_ME',
];

export function isRealConfigValue(value?: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_VALUES.some((placeholder) => trimmed.toUpperCase().includes(placeholder));
}

export function readConfigValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (isRealConfigValue(value)) return value!.trim();
  }
  return '';
}

export function readConfigValueOrDefault(names: string[], fallback: string): string {
  return readConfigValue(...names) || fallback;
}

export function hasConfigValue(...names: string[]): boolean {
  return Boolean(readConfigValue(...names));
}
