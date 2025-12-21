import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderHtmlTemplate,
  showPendingChanges,
  showOriginalContent,
} from './markContentStorageElements';

describe('Pending Changes', () => {
  describe('renderHtmlTemplate', () => {
    describe('Plain Text (No HTML, No Variables)', () => {
      it('should return plain text unchanged', () => {
        const result = renderHtmlTemplate('Hello World');
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hello World');
      });

      it('should handle empty template', () => {
        const result = renderHtmlTemplate('');
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('');
      });
    });

    describe('HTML Only (No Variables)', () => {
      it('should render simple HTML tags', () => {
        const result = renderHtmlTemplate('<strong>Bold</strong>');
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.querySelector('strong')).toBeTruthy();
        expect(container.textContent).toBe('Bold');
      });

      it('should render nested HTML', () => {
        const result = renderHtmlTemplate(
          '<div><strong>Bold</strong> and <em>italic</em></div>'
        );
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.querySelector('strong')).toBeTruthy();
        expect(container.querySelector('em')).toBeTruthy();
        expect(container.textContent).toBe('Bold and italic');
      });

      it('should handle deeply nested HTML structures', () => {
        const template = '<div><ul><li><strong>First</strong></li></ul></div>';
        const result = renderHtmlTemplate(template);
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.querySelector('li strong')?.textContent).toBe('First');
      });
    });

    describe('Variables Only (No HTML) - Double Curly Braces', () => {
      it('should replace double curly bracket variables', () => {
        const result = renderHtmlTemplate('Hello {{name}}', { name: 'John' });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hello John');
      });

      it('should replace multiple double curly bracket variables', () => {
        const result = renderHtmlTemplate('{{greeting}} {{name}}!', {
          greeting: 'Hello',
          name: 'Alice',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hello Alice!');
      });

      it('should preserve unreplaced double curly brackets when variable missing', () => {
        const result = renderHtmlTemplate('Hello {{name}}');
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hello {{name}}');
      });

      it('should preserve placeholders when variables object is undefined', () => {
        const result = renderHtmlTemplate('Hello {{name}}');
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hello {{name}}');
      });

      it('should preserve placeholders when specific variable is missing', () => {
        const result = renderHtmlTemplate('{{greeting}} {{name}}', {
          greeting: 'Hi',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toContain('Hi');
        expect(container.textContent).toContain('{{name}}');
      });
    });

    describe('Variables Only (No HTML) - Single Curly Braces', () => {
      it('should replace single curly bracket variables', () => {
        const result = renderHtmlTemplate('Hello {name}', { name: 'Bob' });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hello Bob');
      });

      it('should replace multiple single curly bracket variables', () => {
        const result = renderHtmlTemplate('{greeting} {name}!', {
          greeting: 'Hi',
          name: 'Charlie',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hi Charlie!');
      });
    });

    describe('Both HTML and Variables', () => {
      it('should render HTML and replace double curly bracket variables', () => {
        const result = renderHtmlTemplate('<strong>Hello {{name}}</strong>', {
          name: 'Diana',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.querySelector('strong')).toBeTruthy();
        expect(container.textContent).toBe('Hello Diana');
      });

      it('should render HTML and replace single curly bracket variables', () => {
        const result = renderHtmlTemplate('<em>Welcome {user}</em>', {
          user: 'Eve',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.querySelector('em')).toBeTruthy();
        expect(container.textContent).toBe('Welcome Eve');
      });

      it('should render complex HTML with multiple variables', () => {
        const template =
          '<div><strong>{{title}}</strong> - <span>{count}</span> items</div>';
        const result = renderHtmlTemplate(template, {
          title: 'Products',
          count: 5,
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.querySelector('strong')?.textContent).toBe('Products');
        expect(container.querySelector('span')?.textContent).toBe('5');
      });
    });

    describe('Mixed Single and Double Brackets', () => {
      it('should handle mixed single and double bracket variables', () => {
        const result = renderHtmlTemplate('{{greeting}} {name}', {
          greeting: 'Hello',
          name: 'Frank',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Hello Frank');
      });

      it('should replace both double and single brackets with same variable', () => {
        const result = renderHtmlTemplate('{{var}} and {var}', { var: 'test' });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('test and test');
      });
    });

    describe('Variable Types', () => {
      it('should handle string variables', () => {
        const result = renderHtmlTemplate('Value: {{val}}', { val: 'text' });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Value: text');
      });

      it('should handle number variables', () => {
        const result = renderHtmlTemplate('Count: {{count}}', { count: 42 });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Count: 42');
      });

      it('should handle boolean variables', () => {
        const result = renderHtmlTemplate('Active: {{active}}', {
          active: true,
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Active: true');
      });
    });

    describe('Special Characters', () => {
      it('should handle special characters in variables', () => {
        const result = renderHtmlTemplate('Price: {{price}}', {
          price: '$99.99',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Price: $99.99');
      });

      it('should handle HTML entities in variables', () => {
        const result = renderHtmlTemplate('Text: {{text}}', {
          text: 'Tom & Jerry',
        });
        const container = document.createElement('div');
        container.appendChild(result);
        expect(container.textContent).toBe('Text: Tom & Jerry');
      });
    });
  });

  describe('showPendingChanges', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      window.memoryMap = new Map();
      window.currentLanguageCode = 'en-US';
    });

    afterEach(() => {
      document.body.innerHTML = '';
      window.memoryMap = new Map();
    });

    describe('Finding Elements', () => {
      it('should find element by data-content-key attribute', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original text';
        document.body.appendChild(elem);

        window.memoryMap.set('Original text', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Updated text',
          },
        ]);

        expect(elem.textContent).toContain('Updated text');
      });

      it('should not update when element not found', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-456');
        elem.textContent = 'Original text';
        document.body.appendChild(elem);

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Updated text',
          },
        ]);

        expect(elem.textContent).toBe('Original text');
      });
    });

    describe('Language Code Matching', () => {
      it('should match language code case-insensitively', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';
        document.body.appendChild(elem);

        window.currentLanguageCode = 'en-US';
        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'EN-us',
            value: 'Updated',
          },
        ]);

        expect(elem.textContent).toContain('Updated');
      });

      it('should skip update when language code does not match', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';
        document.body.appendChild(elem);

        window.currentLanguageCode = 'en-US';

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'fr-FR',
            value: 'Mis à jour',
          },
        ]);

        expect(elem.textContent).toBe('Original');
      });

      it('should handle undefined currentLanguageCode', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';
        document.body.appendChild(elem);

        window.currentLanguageCode = undefined as any;

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Updated',
          },
        ]);

        expect(elem.textContent).toBe('Original');
      });
    });

    describe('Variables from memoryMap', () => {
      it('should look up variables from memoryMap', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Hello John';
        document.body.appendChild(elem);

        window.memoryMap.set('Hello {{name}}', {
          ids: new Set(['content-123']),
          type: 'text',
          variables: { name: 'John' },
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Welcome {{name}}',
          },
        ]);

        expect(elem.textContent).toContain('Welcome John');
      });

      it('should handle missing variables gracefully', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Hello';
        document.body.appendChild(elem);

        window.memoryMap.set('Hello', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Hi {{name}}',
          },
        ]);

        expect(elem.textContent).toContain('Hi {{name}}');
      });
    });

    describe('Rendering HTML and Variables', () => {
      it('should render HTML in pending changes', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';
        document.body.appendChild(elem);

        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: '<strong>Bold Text</strong>',
          },
        ]);

        expect(elem.querySelector('strong')).toBeTruthy();
        expect(elem.querySelector('strong')?.textContent).toBe('Bold Text');
      });

      it('should render HTML and replace variables', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Hello John';
        document.body.appendChild(elem);

        window.memoryMap.set('Hello {{name}}', {
          ids: new Set(['content-123']),
          type: 'text',
          variables: { name: 'John' },
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: '<strong>Welcome {{name}}</strong>',
          },
        ]);

        expect(elem.querySelector('strong')).toBeTruthy();
        expect(elem.querySelector('strong')?.textContent).toBe('Welcome John');
      });
    });

    describe('Preserving UI Elements', () => {
      it('should preserve label element when updating content', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';

        const label = document.createElement('div');
        label.id = 'contentstorage-element-label';
        label.textContent = 'content-123';
        elem.appendChild(label);

        document.body.appendChild(elem);
        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Updated',
          },
        ]);

        expect(elem.querySelector('#contentstorage-element-label')).toBeTruthy();
        expect(
          elem.querySelector('#contentstorage-element-label')?.textContent
        ).toBe('content-123');
      });

      it('should preserve button element when updating content', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';

        const button = document.createElement('button');
        button.id = 'contentstorage-element-button';
        elem.appendChild(button);

        document.body.appendChild(elem);
        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Updated',
          },
        ]);

        expect(elem.querySelector('#contentstorage-element-button')).toBeTruthy();
      });

      it('should preserve both label and button when updating content', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';

        const label = document.createElement('div');
        label.id = 'contentstorage-element-label';
        const button = document.createElement('button');
        button.id = 'contentstorage-element-button';

        elem.appendChild(label);
        elem.appendChild(button);

        document.body.appendChild(elem);
        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Updated',
          },
        ]);

        expect(elem.querySelector('#contentstorage-element-label')).toBeTruthy();
        expect(elem.querySelector('#contentstorage-element-button')).toBeTruthy();
      });
    });

    describe('Marker Attribute', () => {
      it('should set data-content-showing-pending-change attribute', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';
        document.body.appendChild(elem);

        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: 'Updated',
          },
        ]);

        expect(elem.getAttribute('data-content-showing-pending-change')).toBe(
          'true'
        );
      });
    });

    describe('Multiple Pending Changes', () => {
      it('should handle multiple pending changes', () => {
        const elem1 = document.createElement('div');
        elem1.setAttribute('data-content-key', 'content-1');
        elem1.textContent = 'Original 1';

        const elem2 = document.createElement('div');
        elem2.setAttribute('data-content-key', 'content-2');
        elem2.textContent = 'Original 2';

        document.body.appendChild(elem1);
        document.body.appendChild(elem2);

        window.memoryMap.set('Original 1', {
          ids: new Set(['content-1']),
          type: 'text',
        });
        window.memoryMap.set('Original 2', {
          ids: new Set(['content-2']),
          type: 'text',
        });

        showPendingChanges([
          { contentId: 'content-1', langCountry: 'en-US', value: 'Updated 1' },
          { contentId: 'content-2', langCountry: 'en-US', value: 'Updated 2' },
        ]);

        expect(elem1.textContent).toContain('Updated 1');
        expect(elem2.textContent).toContain('Updated 2');
      });
    });

    describe('Edge Cases', () => {
      it('should skip update when value is empty', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';
        document.body.appendChild(elem);

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: '',
          },
        ]);

        expect(elem.textContent).toBe('Original');
      });

      it('should handle null value', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Original';
        document.body.appendChild(elem);

        showPendingChanges([
          {
            contentId: 'content-123',
            langCountry: 'en-US',
            value: null,
          },
        ]);

        expect(elem.textContent).toBe('Original');
      });
    });
  });

  describe('showOriginalContent', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      window.memoryMap = new Map();
    });

    afterEach(() => {
      document.body.innerHTML = '';
      window.memoryMap = new Map();
    });

    describe('Finding Elements', () => {
      it('should find elements with pending changes', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Pending Change';
        document.body.appendChild(elem);

        window.memoryMap.set('Original Text', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showOriginalContent();

        expect(elem.textContent).toContain('Original Text');
      });

      it('should not modify elements without pending changes', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.textContent = 'Normal Text';
        document.body.appendChild(elem);

        showOriginalContent();

        expect(elem.textContent).toBe('Normal Text');
      });
    });

    describe('Restoring Original Content', () => {
      it('should restore original plain text from memoryMap', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed Text';
        document.body.appendChild(elem);

        window.memoryMap.set('Original Text', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showOriginalContent();

        expect(elem.textContent).toContain('Original Text');
        expect(elem.textContent).not.toContain('Changed Text');
      });

      it('should restore original HTML from memoryMap', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.innerHTML = '<em>Changed</em>';
        document.body.appendChild(elem);

        window.memoryMap.set('<strong>Original</strong>', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showOriginalContent();

        expect(elem.querySelector('strong')).toBeTruthy();
        expect(elem.querySelector('strong')?.textContent).toBe('Original');
        expect(elem.querySelector('em')).toBeFalsy();
      });

      it('should restore original text with variables rendered', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed';
        document.body.appendChild(elem);

        window.memoryMap.set('Hello {{name}}', {
          ids: new Set(['content-123']),
          type: 'text',
          variables: { name: 'Alice' },
        });

        showOriginalContent();

        expect(elem.textContent).toContain('Hello Alice');
      });
    });

    describe('Preserving UI Elements', () => {
      it('should preserve label when restoring content', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed';

        const label = document.createElement('div');
        label.id = 'contentstorage-element-label';
        label.textContent = 'content-123';
        elem.appendChild(label);

        document.body.appendChild(elem);

        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showOriginalContent();

        expect(elem.querySelector('#contentstorage-element-label')).toBeTruthy();
        expect(elem.textContent).toContain('Original');
      });

      it('should preserve button when restoring content', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed';

        const button = document.createElement('button');
        button.id = 'contentstorage-element-button';
        elem.appendChild(button);

        document.body.appendChild(elem);

        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showOriginalContent();

        expect(elem.querySelector('#contentstorage-element-button')).toBeTruthy();
      });
    });

    describe('Removing Marker', () => {
      it('should remove data-content-showing-pending-change attribute', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed';
        document.body.appendChild(elem);

        window.memoryMap.set('Original', {
          ids: new Set(['content-123']),
          type: 'text',
        });

        showOriginalContent();

        expect(elem.hasAttribute('data-content-showing-pending-change')).toBe(
          false
        );
      });
    });

    describe('Multiple Elements', () => {
      it('should restore multiple elements with pending changes', () => {
        const elem1 = document.createElement('div');
        elem1.setAttribute('data-content-key', 'content-1');
        elem1.setAttribute('data-content-showing-pending-change', 'true');
        elem1.textContent = 'Changed 1';

        const elem2 = document.createElement('div');
        elem2.setAttribute('data-content-key', 'content-2');
        elem2.setAttribute('data-content-showing-pending-change', 'true');
        elem2.textContent = 'Changed 2';

        document.body.appendChild(elem1);
        document.body.appendChild(elem2);

        window.memoryMap.set('Original 1', {
          ids: new Set(['content-1']),
          type: 'text',
        });
        window.memoryMap.set('Original 2', {
          ids: new Set(['content-2']),
          type: 'text',
        });

        showOriginalContent();

        expect(elem1.textContent).toContain('Original 1');
        expect(elem2.textContent).toContain('Original 2');
        expect(elem1.hasAttribute('data-content-showing-pending-change')).toBe(
          false
        );
        expect(elem2.hasAttribute('data-content-showing-pending-change')).toBe(
          false
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle missing content-key attribute gracefully', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed';
        document.body.appendChild(elem);

        expect(() => showOriginalContent()).not.toThrow();
        expect(elem.textContent).toBe('Changed');
      });

      it('should handle missing memoryMap entry gracefully', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-999');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed';
        document.body.appendChild(elem);

        expect(() => showOriginalContent()).not.toThrow();
        expect(elem.textContent).toBe('Changed');
      });

      it('should handle empty memoryMap', () => {
        const elem = document.createElement('div');
        elem.setAttribute('data-content-key', 'content-123');
        elem.setAttribute('data-content-showing-pending-change', 'true');
        elem.textContent = 'Changed';
        document.body.appendChild(elem);

        window.memoryMap.clear();

        expect(() => showOriginalContent()).not.toThrow();
      });
    });
  });

  describe('Integration: Pending Changes Workflow', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      window.memoryMap = new Map();
      window.currentLanguageCode = 'en-US';
    });

    afterEach(() => {
      document.body.innerHTML = '';
      window.memoryMap = new Map();
    });

    it('should apply and then restore pending changes', () => {
      const elem = document.createElement('div');
      elem.setAttribute('data-content-key', 'content-123');
      elem.textContent = 'Original';
      document.body.appendChild(elem);

      window.memoryMap.set('Original', {
        ids: new Set(['content-123']),
        type: 'text',
      });

      // Apply pending change
      showPendingChanges([
        {
          contentId: 'content-123',
          langCountry: 'en-US',
          value: 'Updated',
        },
      ]);

      expect(elem.textContent).toContain('Updated');
      expect(elem.getAttribute('data-content-showing-pending-change')).toBe(
        'true'
      );

      // Restore original
      showOriginalContent();

      expect(elem.textContent).toContain('Original');
      expect(elem.hasAttribute('data-content-showing-pending-change')).toBe(
        false
      );
    });

    it('should handle complex HTML with variables through full workflow', () => {
      const elem = document.createElement('div');
      elem.setAttribute('data-content-key', 'content-123');
      elem.innerHTML = '<strong>Hello John</strong>';
      document.body.appendChild(elem);

      window.memoryMap.set('<strong>Hello {{name}}</strong>', {
        ids: new Set(['content-123']),
        type: 'text',
        variables: { name: 'John' },
      });

      // Apply pending change with different HTML and variable
      showPendingChanges([
        {
          contentId: 'content-123',
          langCountry: 'en-US',
          value: '<em>Welcome {{name}}</em>',
        },
      ]);

      expect(elem.querySelector('em')).toBeTruthy();
      expect(elem.querySelector('em')?.textContent).toBe('Welcome John');
      expect(elem.querySelector('strong')).toBeFalsy();

      // Restore original
      showOriginalContent();

      expect(elem.querySelector('strong')).toBeTruthy();
      expect(elem.querySelector('strong')?.textContent).toBe('Hello John');
      expect(elem.querySelector('em')).toBeFalsy();
    });
  });
});
