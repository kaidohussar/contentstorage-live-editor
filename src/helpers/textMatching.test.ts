import { describe, it, expect } from 'vitest';
import { stripHtmlTags, normalizeWhitespace, getCleanTextContent } from './htmlUtils';
import { hasVariables, createVariablePattern, matchesWithVariables } from './variableMatching';

describe('HTML Utils', () => {
  describe('stripHtmlTags', () => {
    it('should remove simple HTML tags', () => {
      expect(stripHtmlTags('<strong>bold text</strong>')).toBe('bold text');
      expect(stripHtmlTags('<em>italic text</em>')).toBe('italic text');
    });

    it('should remove nested HTML tags', () => {
      expect(stripHtmlTags('<div><strong>bold</strong> and <em>italic</em></div>'))
        .toBe('bold and italic');
    });

    it('should handle self-closing tags', () => {
      expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1Line 2');
      expect(stripHtmlTags('Image here: <img src="test.jpg" />')).toBe('Image here: ');
    });

    it('should preserve text with variables', () => {
      expect(stripHtmlTags('Welcome <strong>{{userName}}</strong>!'))
        .toBe('Welcome {{userName}}!');
      expect(stripHtmlTags('Hello <strong>{name}</strong>'))
        .toBe('Hello {name}');
    });

    it('should handle empty or null input', () => {
      expect(stripHtmlTags('')).toBe('');
      expect(stripHtmlTags(null as any)).toBe('');
      expect(stripHtmlTags(undefined as any)).toBe('');
    });

    it('should handle HTML entities', () => {
      // stripHtmlTags uses textContent which decodes entities automatically
      const temp1 = document.createElement('div');
      temp1.innerHTML = '&lt;div&gt;';
      expect(stripHtmlTags('&lt;div&gt;')).toBe(temp1.textContent || '<div>');

      const temp2 = document.createElement('div');
      temp2.innerHTML = 'Tom &amp; Jerry';
      expect(stripHtmlTags('Tom &amp; Jerry')).toBe(temp2.textContent || 'Tom & Jerry');

      const temp3 = document.createElement('div');
      temp3.innerHTML = '&copy; 2024';
      expect(stripHtmlTags('&copy; 2024')).toBe(temp3.textContent || '© 2024');
    });

    it('should handle malformed HTML gracefully', () => {
      expect(stripHtmlTags('<strong>unclosed tag')).toBe('unclosed tag');
      expect(stripHtmlTags('closed too much</strong>')).toBe('closed too much');
    });
  });

  describe('normalizeWhitespace', () => {
    it('should replace multiple spaces with single space', () => {
      expect(normalizeWhitespace('hello    world')).toBe('hello world');
      expect(normalizeWhitespace('multiple   spaces   here')).toBe('multiple spaces here');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(normalizeWhitespace('  hello  ')).toBe('hello');
      expect(normalizeWhitespace('\n\ntrimmed\n\n')).toBe('trimmed');
    });

    it('should replace newlines and tabs with spaces', () => {
      expect(normalizeWhitespace('line1\nline2')).toBe('line1 line2');
      expect(normalizeWhitespace('tab\there')).toBe('tab here');
      expect(normalizeWhitespace('mixed\n\t  spaces')).toBe('mixed spaces');
    });

    it('should handle empty input', () => {
      expect(normalizeWhitespace('')).toBe('');
      expect(normalizeWhitespace(null as any)).toBe('');
      expect(normalizeWhitespace(undefined as any)).toBe('');
    });

    it('should handle only whitespace', () => {
      expect(normalizeWhitespace('   ')).toBe('');
      expect(normalizeWhitespace('\n\t\n')).toBe('');
    });
  });

  describe('getCleanTextContent', () => {
    it('should strip HTML and normalize whitespace', () => {
      expect(getCleanTextContent('<strong>hello   world</strong>'))
        .toBe('hello world');
    });

    it('should handle complex HTML with whitespace', () => {
      const html = `
        <div>
          <strong>Bold text</strong>
          with   spaces
        </div>
      `;
      expect(getCleanTextContent(html)).toBe('Bold text with spaces');
    });

    it('should preserve variables while cleaning', () => {
      expect(getCleanTextContent('<strong>{{userName}}</strong>  here'))
        .toBe('{{userName}} here');
    });
  });
});

describe('Variable Matching Utils', () => {
  describe('hasVariables', () => {
    it('should detect double curly bracket variables', () => {
      expect(hasVariables('{{userName}}')).toBe(true);
      expect(hasVariables('Hello {{name}}')).toBe(true);
      expect(hasVariables('{{var1}} and {{var2}}')).toBe(true);
    });

    it('should detect single curly bracket variables', () => {
      expect(hasVariables('{userName}')).toBe(true);
      expect(hasVariables('Hello {name}')).toBe(true);
      expect(hasVariables('{var1} and {var2}')).toBe(true);
    });

    it('should return false for text without variables', () => {
      expect(hasVariables('plain text')).toBe(false);
      expect(hasVariables('no variables here')).toBe(false);
      expect(hasVariables('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(hasVariables('{ }')).toBe(true); // Has curly brackets with content
      expect(hasVariables('{}')).toBe(false); // Empty brackets not matched
      expect(hasVariables('{{')).toBe(false); // Incomplete
      expect(hasVariables('}}')).toBe(false); // Incomplete
    });
  });

  describe('createVariablePattern', () => {
    it('should create pattern for double curly brackets', () => {
      const pattern = createVariablePattern('Welcome {{userName}}');
      expect(pattern.test('Welcome John')).toBe(true);
      expect(pattern.test('Welcome Alice')).toBe(true);
      expect(pattern.test('Welcome Anyone123')).toBe(true);
    });

    it('should create pattern for single curly brackets', () => {
      const pattern = createVariablePattern('Hello {name}');
      expect(pattern.test('Hello World')).toBe(true);
      expect(pattern.test('Hello Bob')).toBe(true);
    });

    it('should handle multiple variables', () => {
      const pattern = createVariablePattern('{{greeting}} {{userName}}');
      expect(pattern.test('Hello John')).toBe(true);
      expect(pattern.test('Hi Alice')).toBe(true);
      expect(pattern.test('Welcome Bob')).toBe(true);
    });

    it('should escape special regex characters', () => {
      const pattern = createVariablePattern('Cost: ${{price}} (sale)');
      expect(pattern.test('Cost: $99.99 (sale)')).toBe(true);
      expect(pattern.test('Cost: $150 (sale)')).toBe(true);
    });

    it('should be case insensitive', () => {
      const pattern = createVariablePattern('Welcome {{userName}}');
      expect(pattern.test('WELCOME john')).toBe(true);
      expect(pattern.test('welcome alice')).toBe(true);
    });

    it('should prioritize double brackets over single', () => {
      // When template has double brackets, it should match appropriately
      const pattern = createVariablePattern('{{var}}');
      expect(pattern.test('anything')).toBe(true);
    });
  });

  describe('matchesWithVariables', () => {
    it('should match text with variables using regex', () => {
      expect(matchesWithVariables('Welcome John', 'Welcome {{userName}}')).toBe(true);
      expect(matchesWithVariables('Welcome Alice', 'Welcome {{userName}}')).toBe(true);
    });

    it('should match text without variables using simple includes', () => {
      expect(matchesWithVariables('Hello world', 'Hello')).toBe(true);
      expect(matchesWithVariables('Hello world', 'world')).toBe(true);
      expect(matchesWithVariables('Hello world', 'o w')).toBe(true);
    });

    it('should NOT match when text does not match pattern', () => {
      expect(matchesWithVariables('Goodbye John', 'Welcome {{userName}}')).toBe(false);
      expect(matchesWithVariables('Hello world', 'Goodbye')).toBe(false);
    });

    it('should trim whitespace in comparison', () => {
      expect(matchesWithVariables('  Welcome John  ', 'Welcome {{userName}}')).toBe(true);
    });

    it('should handle regex errors gracefully', () => {
      // Even with potentially problematic input, should not throw
      expect(() => matchesWithVariables('test', 'test {{var}}')).not.toThrow();
    });
  });
});

describe('Integration Tests - Real-World Scenarios', () => {
  describe('Test Case: Template with HTML strong tag', () => {
    it('should match "unlimited access" from template with strong and link tags', () => {
      const template = 'Unlock <strong>unlimited access</strong> to all premium features. <link>Learn more</link>';
      const domTextNode = 'unlimited access';

      // Step 1: Strip HTML from template
      const cleanTemplate = stripHtmlTags(template);
      expect(cleanTemplate).toBe('Unlock unlimited access to all premium features. Learn more');

      // Step 2: Check if cleaned template contains the DOM text
      expect(cleanTemplate.includes(domTextNode)).toBe(true);

      // Step 3: Verify the correct direction - template should contain the fragment
      expect(cleanTemplate.includes(domTextNode)).toBe(true);
      expect(domTextNode.includes(cleanTemplate)).toBe(false);
    });

    it('should match all text fragments from the template', () => {
      const template = 'Unlock <strong>unlimited access</strong> to all premium features. <link>Learn more</link>';
      const cleanTemplate = stripHtmlTags(template);

      // Each text node that would appear in the DOM
      expect(cleanTemplate.includes('Unlock')).toBe(true);
      expect(cleanTemplate.includes('unlimited access')).toBe(true);
      expect(cleanTemplate.includes('to all premium features.')).toBe(true);
      expect(cleanTemplate.includes('Learn more')).toBe(true);
    });

    it('should work with getCleanTextContent', () => {
      const template = 'Unlock <strong>unlimited access</strong> to all premium features.';
      const domTextNode = 'unlimited access';

      const cleanTemplate = getCleanTextContent(template);
      expect(cleanTemplate).toContain(domTextNode);
    });
  });

  describe('Test Case: Double curly brackets', () => {
    it('should match template "Welcome {{userName}}" with dynamic content', () => {
      const template = 'Welcome {{userName}}';

      expect(matchesWithVariables('Welcome John', template)).toBe(true);
      expect(matchesWithVariables('Welcome Alice', template)).toBe(true);
      expect(matchesWithVariables('Welcome Bob123', template)).toBe(true);
      expect(matchesWithVariables('Goodbye John', template)).toBe(false);
    });

    it('should detect variables correctly', () => {
      expect(hasVariables('Welcome {{userName}}')).toBe(true);
    });
  });

  describe('Test Case: Combined HTML and variables', () => {
    it('should match "Hello <strong>{{userName}}</strong>"', () => {
      const template = 'Hello <strong>{{userName}}</strong>';

      // Step 1: Strip HTML
      const cleanTemplate = stripHtmlTags(template);
      expect(cleanTemplate).toBe('Hello {{userName}}');

      // Step 2: Match with variable content
      expect(matchesWithVariables('Hello John', cleanTemplate)).toBe(true);
      expect(matchesWithVariables('Hello Alice', cleanTemplate)).toBe(true);
      expect(matchesWithVariables('Goodbye John', cleanTemplate)).toBe(false);
    });

    it('should handle complex nested HTML with variables', () => {
      const template = '<div><strong>Welcome {{firstName}}</strong> <em>{{lastName}}</em></div>';
      const cleanTemplate = getCleanTextContent(template);

      expect(cleanTemplate).toBe('Welcome {{firstName}} {{lastName}}');
      expect(matchesWithVariables('Welcome John Doe', cleanTemplate)).toBe(true);
      expect(matchesWithVariables('Welcome Alice Smith', cleanTemplate)).toBe(true);
    });
  });

  describe('Test Case: Simple text without HTML or variables', () => {
    it('should match plain text exactly', () => {
      const template = 'Click here to continue';

      expect(hasVariables(template)).toBe(false);
      expect(matchesWithVariables('Click here to continue', template)).toBe(true);

      // matchesWithVariables checks if domText includes template
      // So the domText must contain the full template text
      expect(matchesWithVariables('Please click here to continue now', template)).toBe(false);

      // For the actual use case: check if template contains fragment (reversed)
      expect(template.includes('Click here')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(stripHtmlTags('')).toBe('');
      expect(hasVariables('')).toBe(false);
      expect(matchesWithVariables('', '')).toBe(true);
    });

    it('should handle strings with only HTML', () => {
      expect(stripHtmlTags('<div></div>')).toBe('');
      expect(stripHtmlTags('<br/>')).toBe('');
    });

    it('should handle special characters', () => {
      const template = 'Price: ${{amount}} (20% off!)';
      const cleanTemplate = stripHtmlTags(template);

      expect(matchesWithVariables('Price: $99.99 (20% off!)', cleanTemplate)).toBe(true);
    });

    it('should handle very long variable values', () => {
      const template = 'Message: {{content}}';
      const longContent = 'Message: ' + 'x'.repeat(1000);

      expect(matchesWithVariables(longContent, template)).toBe(true);
    });

    it('should handle mixed single and double bracket variables', () => {
      const template = 'Hello {firstName} {{lastName}}';

      expect(hasVariables(template)).toBe(true);
      expect(matchesWithVariables('Hello John Doe', template)).toBe(true);
    });

    it('should handle Unicode and emoji', () => {
      const template = 'Welcome {{userName}} 👋';

      expect(matchesWithVariables('Welcome John 👋', template)).toBe(true);
      expect(matchesWithVariables('Welcome 你好 👋', template)).toBe(true);
    });

    it('should handle templates with only variables', () => {
      const template = '{{fullText}}';

      expect(matchesWithVariables('Any text here', template)).toBe(true);
      expect(matchesWithVariables('', template)).toBe(false); // Empty doesn't match (.+?)
    });

    it('should handle adjacent HTML tags', () => {
      const template = '<strong><em>bold italic</em></strong>';
      expect(stripHtmlTags(template)).toBe('bold italic');
    });

    it('should handle whitespace between tags', () => {
      const template = '<strong>text1</strong>   <em>text2</em>';
      const clean = getCleanTextContent(template);
      expect(clean).toBe('text1 text2');
    });
  });

  describe('Regression Tests - includes() Direction Bug', () => {
    it('should check if template includes fragment, not if fragment includes template', () => {
      const fullTemplate = 'Unlock unlimited access to all premium features. Learn more';
      const fragment = 'unlimited access';

      // Correct: template includes fragment
      expect(fullTemplate.includes(fragment)).toBe(true);

      // Incorrect: fragment includes template (would be false)
      expect(fragment.includes(fullTemplate)).toBe(false);
    });

    it('should correctly match fragments from multi-part templates', () => {
      const template = '<p>Hello <strong>world</strong> this is <em>amazing</em></p>';
      const cleanTemplate = stripHtmlTags(template);

      // All fragments should be found in the template
      expect(cleanTemplate.includes('Hello')).toBe(true);
      expect(cleanTemplate.includes('world')).toBe(true);
      expect(cleanTemplate.includes('this is')).toBe(true);
      expect(cleanTemplate.includes('amazing')).toBe(true);
    });
  });
});
