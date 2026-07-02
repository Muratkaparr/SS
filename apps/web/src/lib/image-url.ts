const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function productImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return `${API_ORIGIN}${imageUrl}`;
}
