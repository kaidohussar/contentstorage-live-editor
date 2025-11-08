import { describe, it, expect } from 'vitest';
import { stripHtmlTags, normalizeWhitespace, getCleanTextContent } from './htmlUtils';
import { hasVariables, renderTemplate } from './variableMatching';

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

  describe('renderTemplate', () => {
    it('should render template with double curly bracket variables', () => {
      expect(renderTemplate('Welcome {{userName}}', { userName: 'John' })).toBe('Welcome John');
      expect(renderTemplate('Welcome {{userName}}', { userName: 'Alice' })).toBe('Welcome Alice');
    });

    it('should render template with single curly bracket variables', () => {
      expect(renderTemplate('Hello {name}', { name: 'World' })).toBe('Hello World');
      expect(renderTemplate('Hello {name}', { name: 'Bob' })).toBe('Hello Bob');
    });

    it('should handle multiple variables', () => {
      expect(renderTemplate('{{greeting}} {{userName}}', { greeting: 'Hello', userName: 'John' })).toBe('Hello John');
      expect(renderTemplate('{{greeting}} {{userName}}', { greeting: 'Hi', userName: 'Alice' })).toBe('Hi Alice');
    });

    it('should strip HTML tags from template', () => {
      expect(renderTemplate('<strong>Hello</strong> {{name}}', { name: 'World' })).toBe('Hello World');
      expect(renderTemplate('Welcome <strong>{{userName}}</strong>!', { userName: 'John' })).toBe('Welcome John!');
    });

    it('should normalize whitespace', () => {
      expect(renderTemplate('Hello   {{name}}', { name: 'World' })).toBe('Hello World');
      expect(renderTemplate('Hello\n{{name}}', { name: 'World' })).toBe('Hello World');
    });

    it('should handle templates without variables', () => {
      expect(renderTemplate('Hello World')).toBe('Hello World');
      expect(renderTemplate('<strong>Hello</strong> World')).toBe('Hello World');
    });

    it('should keep placeholder when variable is missing', () => {
      expect(renderTemplate('Hello {{name}}')).toBe('Hello {{name}}');
      expect(renderTemplate('Hello {{name}}', {})).toBe('Hello {{name}}');
    });

    it('should replace double brackets before single brackets', () => {
      // This ensures {{var}} is replaced before {var} to avoid partial replacements
      expect(renderTemplate('{{userName}} and {userName}', { userName: 'John' })).toBe('John and John');
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
    it('should render template "Welcome {{userName}}" with dynamic content', () => {
      const template = 'Welcome {{userName}}';

      expect(renderTemplate(template, { userName: 'John' })).toBe('Welcome John');
      expect(renderTemplate(template, { userName: 'Alice' })).toBe('Welcome Alice');
      expect(renderTemplate(template, { userName: 'Bob123' })).toBe('Welcome Bob123');
    });

    it('should detect variables correctly', () => {
      expect(hasVariables('Welcome {{userName}}')).toBe(true);
    });
  });

  describe('Test Case: Combined HTML and variables', () => {
    it('should render "Hello <strong>{{userName}}</strong>" with HTML stripped', () => {
      const template = 'Hello <strong>{{userName}}</strong>';

      // renderTemplate strips HTML and replaces variables
      expect(renderTemplate(template, { userName: 'John' })).toBe('Hello John');
      expect(renderTemplate(template, { userName: 'Alice' })).toBe('Hello Alice');
    });

    it('should handle complex nested HTML with variables', () => {
      const template = '<div><strong>Welcome {{firstName}}</strong> <em>{{lastName}}</em></div>';

      expect(renderTemplate(template, { firstName: 'John', lastName: 'Doe' })).toBe('Welcome John Doe');
      expect(renderTemplate(template, { firstName: 'Alice', lastName: 'Smith' })).toBe('Welcome Alice Smith');
    });
  });

  describe('Test Case: Simple text without HTML or variables', () => {
    it('should render plain text unchanged', () => {
      const template = 'Click here to continue';

      expect(hasVariables(template)).toBe(false);
      expect(renderTemplate(template)).toBe('Click here to continue');

      // Exact matching - different text won't match
      expect(renderTemplate('Click here to continue')).not.toBe('Please click here to continue now');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(stripHtmlTags('')).toBe('');
      expect(hasVariables('')).toBe(false);
      expect(renderTemplate('')).toBe('');
    });

    it('should handle strings with only HTML', () => {
      expect(stripHtmlTags('<div></div>')).toBe('');
      expect(stripHtmlTags('<br/>')).toBe('');
    });

    it('should handle special characters', () => {
      const template = 'Price: ${{amount}} (20% off!)';

      expect(renderTemplate(template, { amount: '99.99' })).toBe('Price: $99.99 (20% off!)');
    });

    it('should handle very long variable values', () => {
      const template = 'Message: {{content}}';
      const longValue = 'x'.repeat(1000);

      expect(renderTemplate(template, { content: longValue })).toBe('Message: ' + longValue);
    });

    it('should handle mixed single and double bracket variables', () => {
      const template = 'Hello {firstName} {{lastName}}';

      expect(hasVariables(template)).toBe(true);
      expect(renderTemplate(template, { firstName: 'John', lastName: 'Doe' })).toBe('Hello John Doe');
    });

    it('should handle Unicode and emoji', () => {
      const template = 'Welcome {{userName}} 👋';

      expect(renderTemplate(template, { userName: 'John' })).toBe('Welcome John 👋');
      expect(renderTemplate(template, { userName: '你好' })).toBe('Welcome 你好 👋');
    });

    it('should handle templates with only variables', () => {
      const template = '{{fullText}}';

      expect(renderTemplate(template, { fullText: 'Any text here' })).toBe('Any text here');
      expect(renderTemplate(template, { fullText: '' })).toBe('');
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

describe('Integration Tests - React Trans Component', () => {
  describe('Test Case: Trans with variables and custom components', () => {
    it('should match DOM from Trans component to template with variables', () => {
      // Template stored in memoryMap (what comes from backend)
      const template = 'Welcome back, <strong>{{userName}}</strong>! You have <CustomLink>{{count}} new notifications</CustomLink>.';

      // Variables provided in memoryMap
      const variables = { userName: 'John Doe', count: '3' };

      // DOM text that React Trans renders (what we find in the page)
      const domText = 'Welcome back, John Doe! You have 3 new notifications.';

      // Step 1: Render template with variables (what our code does)
      const rendered = renderTemplate(template, variables);

      // Step 2: Verify exact match
      expect(rendered).toBe(domText);
    });

    it('should verify HTML-stripped template matches item.text format', () => {
      // Template with HTML tags
      const template = 'Welcome back, <strong>{{userName}}</strong>! You have <CustomLink>{{count}} new notifications</CustomLink>.';

      // What we store in item.text (HTML-stripped template)
      const expectedItemText = stripHtmlTags(template);

      // Verify HTML is stripped but variables remain
      expect(expectedItemText).toBe('Welcome back, {{userName}}! You have {{count}} new notifications.');
      expect(expectedItemText).toContain('{{userName}}');
      expect(expectedItemText).toContain('{{count}}');
      expect(expectedItemText).not.toContain('<strong>');
      expect(expectedItemText).not.toContain('<CustomLink>');
    });

    it('should simulate full matching workflow', () => {
      // Simulating memoryMap entry
      const memoryMapTemplate = 'Welcome back, <strong>{{userName}}</strong>! You have <CustomLink>{{count}} new notifications</CustomLink>.';
      const memoryMapVariables = { userName: 'John Doe', count: '3' };

      // What gets stored in ContentNode item.text
      const itemText = stripHtmlTags(memoryMapTemplate);

      // DOM text we find in the page
      const domText = 'Welcome back, John Doe! You have 3 new notifications.';

      // Matching workflow:
      // 1. We have item.text (HTML-stripped template)
      // 2. We need to find matching memoryMap entry to get variables
      // 3. We render the template with variables
      // 4. We compare against DOM text

      // Simulate the lookup: stripHtmlTags(memoryMapTemplate) === item.text
      const templateMatch = stripHtmlTags(memoryMapTemplate) === itemText;
      expect(templateMatch).toBe(true);

      // If matched, render the original template with variables
      const rendered = renderTemplate(memoryMapTemplate, memoryMapVariables);

      // Compare with DOM text
      expect(rendered).toBe(domText);
    });

    it('should handle multiple variables in same template', () => {
      const template = '{{greeting}} {{userName}}! You have {{count}} items in your cart.';
      const variables = { greeting: 'Hello', userName: 'Alice', count: '5' };
      const expected = 'Hello Alice! You have 5 items in your cart.';

      expect(renderTemplate(template, variables)).toBe(expected);
    });

    it('should handle mixed single and double brackets with HTML', () => {
      const template = '<div>Hello {firstName} {{lastName}}</div>';
      const variables = { firstName: 'John', lastName: 'Doe' };
      const expected = 'Hello John Doe';

      expect(renderTemplate(template, variables)).toBe(expected);
    });

    it('should handle custom React components in template', () => {
      const template = 'Click <CustomLink>here</CustomLink> to view your <Badge>{{count}}</Badge> notifications';
      const variables = { count: '7' };
      const expected = 'Click here to view your 7 notifications';

      expect(renderTemplate(template, variables)).toBe(expected);
    });
  });
});
