// HTML utilities for processing template text that may contain HTML tags

/**
 * Strips HTML tags from a string, leaving only text content
 * Handles both simple tags like <strong> and self-closing tags
 *
 * @param html - String that may contain HTML tags
 * @returns Plain text with HTML tags removed
 *
 * @example
 * stripHtmlTags("Welcome <strong>{{userName}}</strong>!")
 * // Returns: "Welcome {{userName}}!"
 */
export const stripHtmlTags = (html: string): string => {
  if (!html) return '';

  // Create a temporary DOM element to parse HTML
  // This handles nested tags, entities, and edge cases correctly
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // textContent automatically strips all HTML tags
  return temp.textContent || temp.innerText || '';
};

/**
 * Normalizes whitespace in text by:
 * - Replacing multiple spaces with single space
 * - Trimming leading/trailing whitespace
 * - Replacing newlines/tabs with spaces
 *
 * This helps match text content when HTML formatting adds extra whitespace
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
export const normalizeWhitespace = (text: string): string => {
  if (!text) return '';

  return text
    .replace(/\s+/g, ' ')  // Replace multiple whitespace chars with single space
    .trim();                // Remove leading/trailing whitespace
};

/**
 * Strips HTML tags and normalizes whitespace in one operation
 * Useful for comparing template text with DOM text content
 *
 * @param html - String that may contain HTML tags
 * @returns Plain text with tags removed and whitespace normalized
 */
export const getCleanTextContent = (html: string): string => {
  return normalizeWhitespace(stripHtmlTags(html));
};
