/**
 * Convert a string to a URL-friendly slug
 * @param s - The string to slugify
 * @returns A lowercase slug with hyphens instead of spaces/special characters
 */
export const slug = (s: string): string => {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};