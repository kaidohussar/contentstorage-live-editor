// Variable matching utilities for handling content with variables like {name}, {days}, {{name}}, {{days}}, etc.

export const hasVariables = (text: string): boolean => {
  // Match both double curly brackets {{var}} and single curly brackets {var}
  return /\{\{[^}]+\}\}|\{[^}]+\}/g.test(text);
};

export const createVariablePattern = (templateText: string): RegExp => {
  // Escape special regex characters except our variable placeholders
  let escapedText = templateText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Replace escaped variable placeholders with flexible matchers
  // IMPORTANT: Replace double curly brackets {{variableName}} FIRST (before single brackets)
  // This prevents partial replacement of double brackets
  escapedText = escapedText.replace(/\\{\\{[^}]+\\}\\}/g, '(.+?)');

  // Then replace single curly brackets {variableName}
  escapedText = escapedText.replace(/\\{[^}]+\\}/g, '(.+?)');

  // Allow flexible whitespace around the pattern
  escapedText = escapedText.trim();

  // Create regex that allows for flexible matching (not requiring exact start/end)
  // Use word boundaries when possible, but make it more flexible
  return new RegExp(escapedText, 'i');
};

export const matchesWithVariables = (domText: string, templateText: string): boolean => {
  // Check for variables first to determine matching strategy
  if (hasVariables(templateText)) {
    // Template has variables - use regex matching
    try {
      const pattern = createVariablePattern(templateText);
      return pattern.test(domText.trim());
    } catch (error) {
      // Fallback to simple includes if regex fails
      console.warn('[Live editor] Variable pattern matching failed:', error);
      return domText.includes(templateText);
    }
  }
  
  // No variables - use fast simple includes
  return domText.includes(templateText);
};