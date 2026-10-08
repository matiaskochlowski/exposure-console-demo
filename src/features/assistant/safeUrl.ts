/** Only absolute https: URLs survive; everything else (javascript:, data:, relative, http:) becomes ''. */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}
