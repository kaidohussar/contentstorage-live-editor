// Variable matching utilities for handling content with variables like {name}, {days}, etc.

export const hasVariables = (text: string): boolean => {
  return /\{[^}]+\}/g.test(text);
};

export const createVariablePattern = (templateText: string): RegExp => {
  // Escape special regex characters except our variable placeholders
  let escapedText = templateText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace escaped variable placeholders with flexible matchers
  // Match escaped {variableName} pattern and replace with (.+?) for non-greedy matching
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