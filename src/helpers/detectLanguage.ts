/**
 * Language detection utility for standalone browser script mode.
 * Detects the current page language to send to parent for accurate content matching.
 */

/**
 * Normalize language codes to uppercase 2-letter format
 * Examples: "en-US" → "EN", "en_GB" → "EN", "de" → "DE"
 */
function normalizeLanguageCode(code: string): string | null {
  if (!code) return null;

  // Extract primary language code (before hyphen or underscore)
  const primary = code.split(/[-_]/)[0].toUpperCase();

  // Only return valid 2-letter codes
  return primary.length === 2 ? primary : null;
}

/**
 * Detect language from URL patterns
 * Supports: /en/page, /en-us/page, en.example.com, ?lang=en, ?locale=en
 */
function detectLanguageFromUrl(): string | null {
  const pathname = window.location.pathname;
  const hostname = window.location.hostname;

  // Pattern: /en/page or /en-us/page (language code at start of path)
  const pathMatch = pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)\//i);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Pattern: en.example.com (language subdomain, but not www)
  const subdomainMatch = hostname.match(/^([a-z]{2})\.(?!www)/i);
  if (subdomainMatch) {
    return subdomainMatch[1];
  }

  // Pattern: ?lang=en or ?locale=en (query parameters)
  const params = new URLSearchParams(window.location.search);
  return params.get('lang') || params.get('locale') || null;
}

/**
 * Detect the current page language using multiple strategies (in priority order):
 * 1. HTML lang attribute (most reliable, W3C standard)
 * 2. Meta tags (language, Content-Language)
 * 3. URL patterns (path, subdomain, query params)
 * 4. window.currentLanguageCode (set by contentstorage SDK)
 *
 * @returns Normalized uppercase 2-letter language code (e.g., "EN", "DE") or null
 */
export function detectPageLanguage(): string | null {
  // 1. HTML lang attribute (most reliable, W3C standard)
  const htmlLang = document.documentElement.lang;
  if (htmlLang) {
    const normalized = normalizeLanguageCode(htmlLang);
    if (normalized) return normalized;
  }

  // 2. Meta tags
  const metaLang =
    document.querySelector('meta[name="language"]')?.getAttribute('content') ||
    document.querySelector('meta[http-equiv="Content-Language"]')?.getAttribute('content');
  if (metaLang) {
    const normalized = normalizeLanguageCode(metaLang);
    if (normalized) return normalized;
  }

  // 3. URL patterns (path, subdomain, query params)
  const urlLang = detectLanguageFromUrl();
  if (urlLang) {
    const normalized = normalizeLanguageCode(urlLang);
    if (normalized) return normalized;
  }

  // 4. Check if contentstorage SDK has set the language
  if (window.currentLanguageCode) {
    const normalized = normalizeLanguageCode(window.currentLanguageCode);
    if (normalized) return normalized;
  }

  // Return null - let parent handle detection via content matching
  return null;
}