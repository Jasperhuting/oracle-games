export function getNewsReadingTimeMinutes(content: string): number {
  const plainText = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) return 1;

  const words = plainText.split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
