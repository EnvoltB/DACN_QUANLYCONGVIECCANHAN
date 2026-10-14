/**
 * Helper to remove Vietnamese diacritics / tones for resilient text search
 * Supports typing with or without accents: "thiet ke" matches "Thiết kế"
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}

export function matchesSearch(source: string | undefined | null, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!source) return false;
  const normalizedSource = removeVietnameseTones(source);
  const normalizedQuery = removeVietnameseTones(query);
  return normalizedSource.includes(normalizedQuery);
}
