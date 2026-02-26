import { describe, it, expect, beforeEach } from 'vitest';
import {
  templateToRegex,
  computeStaticOverlap,
  fuzzyMatchContent,
} from './fuzzyMatching';

describe('templateToRegex', () => {
  it('should convert template with single variable to regex', () => {
    const regex = templateToRegex('Hello {{name}}');
    expect(regex).not.toBeNull();
    expect(regex!.test('Hello John')).toBe(true);
    expect(regex!.test('Hello World')).toBe(true);
    expect(regex!.test('Hello')).toBe(false);
    expect(regex!.test('Hi John')).toBe(false);
  });

  it('should convert template with variable at start', () => {
    const regex = templateToRegex('{{count}} items in cart');
    expect(regex).not.toBeNull();
    expect(regex!.test('3 items in cart')).toBe(true);
    expect(regex!.test('100 items in cart')).toBe(true);
    expect(regex!.test('items in cart')).toBe(false);
  });

  it('should convert template with variable in middle', () => {
    const regex = templateToRegex('You have {{count}} items');
    expect(regex).not.toBeNull();
    expect(regex!.test('You have 5 items')).toBe(true);
    expect(regex!.test('You have 100 items')).toBe(true);
    expect(regex!.test('You have items')).toBe(false);
  });

  it('should handle multiple variables', () => {
    const regex = templateToRegex('{{greeting}} dear {{name}}, welcome!');
    expect(regex).not.toBeNull();
    expect(regex!.test('Hello dear John, welcome!')).toBe(true);
    expect(regex!.test('Hi dear Alice, welcome!')).toBe(true);
  });

  it('should return null when multiple variables leave too little static text', () => {
    // ", " and "!" total only 2 chars — too little static text
    expect(templateToRegex('{{greeting}}, {{name}}!')).toBeNull();
  });

  it('should handle single curly bracket variables', () => {
    const regex = templateToRegex('Hello {name}');
    expect(regex).not.toBeNull();
    expect(regex!.test('Hello John')).toBe(true);
  });

  it('should return null for templates without variables', () => {
    expect(templateToRegex('No variables here')).toBeNull();
    expect(templateToRegex('Plain text')).toBeNull();
  });

  it('should return null when static text is too short', () => {
    // Only variable, no static text
    expect(templateToRegex('{{all_variable}}')).toBeNull();
    // Very short static text (< 3 chars)
    expect(templateToRegex('{{a}} b')).toBeNull();
  });

  it('should strip HTML tags before building regex', () => {
    const regex = templateToRegex('<b>{{name}}</b> welcome');
    expect(regex).not.toBeNull();
    expect(regex!.test('John welcome')).toBe(true);
    expect(regex!.test('Alice welcome')).toBe(true);
  });

  it('should return null for HTML template with too little static text after stripping', () => {
    // After stripping <strong>...</strong>, only the variable text remains
    expect(templateToRegex('<strong>{{userName}}</strong>')).toBeNull();
  });

  it('should handle special regex characters in static text', () => {
    const regex = templateToRegex('Price: ${{amount}} (20% off!)');
    expect(regex).not.toBeNull();
    expect(regex!.test('Price: $99.99 (20% off!)')).toBe(true);
    expect(regex!.test('Price: $5 (20% off!)')).toBe(true);
  });

  it('should handle complex template with HTML and multiple variables', () => {
    const regex = templateToRegex(
      'Welcome back, <strong>{{userName}}</strong>! You have <CustomLink>{{count}} new notifications</CustomLink>.'
    );
    expect(regex).not.toBeNull();
    expect(regex!.test('Welcome back, John! You have 3 new notifications.')).toBe(true);
    expect(regex!.test('Welcome back, Alice! You have 10 new notifications.')).toBe(true);
  });
});

describe('computeStaticOverlap', () => {
  it('should return 1.0 when all static parts are present', () => {
    const score = computeStaticOverlap(
      'Hello John',
      'Hello {{name}}'
    );
    expect(score).toBe(1.0);
  });

  it('should return partial score when some static parts match', () => {
    const score = computeStaticOverlap(
      'Hi John, you have 5 items',
      'Hello {{name}}, you have {{count}} items'
    );
    // "Hello " doesn't match, but ", you have " and " items" do
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('should return 0 for completely unrelated text', () => {
    const score = computeStaticOverlap(
      'Something completely different',
      'Hello {{name}}'
    );
    expect(score).toBe(0);
  });

  it('should return 0 for empty template', () => {
    expect(computeStaticOverlap('some text', '')).toBe(0);
  });

  it('should handle templates with no static parts', () => {
    expect(computeStaticOverlap('anything', '{{var}}')).toBe(0);
  });
});

describe('fuzzyMatchContent', () => {
  beforeEach(() => {
    // Set up memoryMap
    window.memoryMap = new Map();
    window.currentLanguageCode = 'EN';
  });

  it('should return empty array when no DOM nodes found', () => {
    const results = fuzzyMatchContent();
    expect(results).toEqual([]);
  });

  it('should match exact text from memoryMap', () => {
    // Set up memoryMap with a translation
    window.memoryMap.set('Sign up now', {
      ids: new Set(['cta_key']),
      type: 'text',
    });

    // Add matching text to DOM
    document.body.innerHTML = '<p>Sign up now</p>';

    const results = fuzzyMatchContent();
    const match = results.find((r) => r.text === 'Sign up now');
    expect(match).toBeDefined();
    expect(match!.matchedKeys[0]).toBe('cta_key');
    expect(match!.matchScore).toBe(1.0);
    expect(match!.potentialCandidates).toEqual([]);
  });

  it('should match via template pattern when variables are present', () => {
    window.memoryMap.set('Hello {{name}}', {
      ids: new Set(['greeting_key']),
      type: 'text',
      variables: { name: 'World' },
    });

    document.body.innerHTML = '<p>Hello John</p>';

    const results = fuzzyMatchContent();
    const match = results.find((r) => r.text === 'Hello John');
    expect(match).toBeDefined();
    expect(match!.matchedKeys[0]).toBe('greeting_key');
    expect(match!.matchScore).toBe(1.0);
  });

  it('should match via rendered template exact match', () => {
    window.memoryMap.set('Hello {{name}}', {
      ids: new Set(['greeting_key']),
      type: 'text',
      variables: { name: 'World' },
    });

    // DOM has the rendered text matching the template with known variables
    document.body.innerHTML = '<p>Hello World</p>';

    const results = fuzzyMatchContent();
    const match = results.find((r) => r.text === 'Hello World');
    expect(match).toBeDefined();
    expect(match!.matchedKeys[0]).toBe('greeting_key');
    expect(match!.matchScore).toBe(1.0);
  });

  it('should add memoryMap alias for pattern matches', () => {
    window.memoryMap.set('You have {{count}} new messages', {
      ids: new Set(['msg_key']),
      type: 'text',
      variables: { count: '3' },
    });

    document.body.innerHTML = '<p>You have 5 new messages</p>';

    fuzzyMatchContent();

    // The DOM text should now be in memoryMap as an alias
    const alias = window.memoryMap.get('You have 5 new messages');
    expect(alias).toBeDefined();
    expect(alias!.ids.has('msg_key')).toBe(true);
  });

  it('should not produce candidates for plain text near-matches', () => {
    window.memoryMap.set('Sign up now', {
      ids: new Set(['cta_key']),
      type: 'text',
    });

    // Similar text but plain templates either exact-match or aren't on the page
    document.body.innerHTML = '<p>Sign up today</p>';

    const results = fuzzyMatchContent();
    const unmatched = results.find((r) => r.text === 'Sign up today');
    expect(unmatched).toBeDefined();
    expect(unmatched!.matchedKeys).toEqual([]);
    expect(unmatched!.potentialCandidates).toEqual([]);
  });

  it('should return unmatched text with no candidates for completely different text', () => {
    window.memoryMap.set('Hello World', {
      ids: new Set(['key1']),
      type: 'text',
    });

    document.body.innerHTML = '<p>Something completely unrelated to any translation</p>';

    const results = fuzzyMatchContent();
    const unmatched = results.find((r) =>
      r.text === 'Something completely unrelated to any translation'
    );
    expect(unmatched).toBeDefined();
    expect(unmatched!.matchedKeys).toEqual([]);
    expect(unmatched!.potentialCandidates).toEqual([]);
  });

  it('should handle multiple matches on a page', () => {
    window.memoryMap.set('Hello World', {
      ids: new Set(['key1']),
      type: 'text',
    });
    window.memoryMap.set('Welcome {{name}}', {
      ids: new Set(['key2']),
      type: 'text',
      variables: { name: 'User' },
    });

    document.body.innerHTML = '<div><p>Hello World</p><p>Welcome John</p></div>';

    const results = fuzzyMatchContent();
    const exactMatch = results.find((r) => r.text === 'Hello World');
    const patternMatch = results.find((r) => r.text === 'Welcome John');

    expect(exactMatch).toBeDefined();
    expect(exactMatch!.matchedKeys[0]).toBe('key1');
    expect(exactMatch!.matchScore).toBe(1.0);

    expect(patternMatch).toBeDefined();
    expect(patternMatch!.matchedKeys[0]).toBe('key2');
    expect(patternMatch!.matchScore).toBe(1.0);
  });
});
