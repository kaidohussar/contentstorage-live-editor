// Variable matching utilities for handling content with variables like {name}, {days}, {{name}}, {{days}}, etc.

import { stripHtmlTags, normalizeWhitespace } from './htmlUtils';

export const hasVariables = (text: string): boolean => {
  // Match both double curly brackets {{var}} and single curly brackets {var}
  return /\{\{[^}]+\}\}|\{[^}]+\}/g.test(text);
};

/**
 * Renders a template by replacing variable placeholders with actual values
 * and stripping HTML tags for exact matching.
 *
 * Process:
 * 1. Strip HTML tags from template (including custom tags like <CustomLink>)
 * 2. Replace {{varName}} with actual values (double brackets first)
 * 3. Replace {varName} with actual values (single brackets)
 * 4. Normalize whitespace
 *
 * @param templateText - Template string with {{varName}} or {varName} placeholders and possibly HTML
 * @param variables - Object with variable key-value pairs (values can be string, number, or boolean)
 * @returns Rendered text with variables substituted and HTML stripped, ready for exact comparison
 *
 * @example
 * renderTemplate("Hello {{name}}", { name: "John" })
 * // Returns: "Hello John"
 *
 * @example
 * renderTemplate("<strong>{{userName}}</strong>", { userName: "John Doe" })
 * // Returns: "John Doe"
 *
 * @example
 * renderTemplate("Welcome back, <strong>{{userName}}</strong>! You have <CustomLink>{{count}} new notifications</CustomLink>.",
 *                { userName: "John Doe", count: 3 })
 * // Returns: "Welcome back, John Doe! You have 3 new notifications."
 */
export const renderTemplate = (
  templateText: string,
  variables?: Record<string, string | number | boolean>
): string => {
  // Step 1: Strip HTML tags first
  let rendered = stripHtmlTags(templateText);

  // Step 2: Replace variables with actual values if provided
  if (variables) {
    // Replace {{varName}} FIRST (before {varName}) to avoid partial replacements
    Object.entries(variables).forEach(([key, value]) => {
      const doublePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(doublePattern, String(value));
    });

    // Then replace {varName}
    Object.entries(variables).forEach(([key, value]) => {
      const singlePattern = new RegExp(`\\{${key}\\}`, 'g');
      rendered = rendered.replace(singlePattern, String(value));
    });
  }

  // Step 3: Normalize whitespace
  return normalizeWhitespace(rendered);
};