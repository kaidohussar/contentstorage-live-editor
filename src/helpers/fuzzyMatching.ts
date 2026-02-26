import { findContentNodesInPage } from './domTreeWalker';
import { getCleanTextContent, getElementPath } from './mutationObserver';
import { renderTemplate, hasVariables } from './variableMatching';
import { normalizeWhitespace } from './htmlUtils';
import { stripHtmlTags } from './htmlUtils';
import { sortKeysByPageContext } from './memoryMapUtils';

export interface PotentialCandidate {
  contentKey: string;
  text: string;
  score: number;
}

export interface FuzzyMatchResult {
  text: string;
  elementPath: string;
  matchedKeys: string[];
  matchedTranslation: string | null;
  matchScore: number;
  potentialCandidates: PotentialCandidate[];
}

export interface FuzzyMatchOptions {
  candidateThreshold?: number;
}

// Regex to match variable placeholders: {{var}} or {var}
const VARIABLE_PATTERN = /\{\{[^}]+\}\}|\{[^}]+\}/g;

/**
 * Minimum total length of static text parts required for a valid regex pattern.
 * Prevents overly broad matches from templates with very little static text.
 */
const MIN_STATIC_LENGTH = 3;

/**
 * Convert a template string containing {{var}} or {var} placeholders into a RegExp
 * that matches the rendered text with any variable values.
 *
 * Returns null if:
 * - Template has no variables
 * - Static content is too short (< MIN_STATIC_LENGTH chars) to avoid overly broad matches
 *
 * @example
 * templateToRegex("Hello {{name}}") → /^Hello (.+?)$/
 * templateToRegex("You have {{count}} items") → /^You have (.+?) items$/
 * templateToRegex("No variables here") → null
 * templateToRegex("{{all_variable}}") → null (too little static text)
 */
export function templateToRegex(template: string): RegExp | null {
  if (!hasVariables(template)) return null;

  // Strip HTML tags first (same as renderTemplate does)
  const stripped = stripHtmlTags(template);
  const normalized = normalizeWhitespace(stripped);

  if (!normalized) return null;

  // Split the normalized text by variable placeholders
  const parts = normalized.split(VARIABLE_PATTERN);

  // Calculate total static text length
  const totalStaticLength = parts.reduce(
    (sum, part) => sum + part.trim().length,
    0
  );

  if (totalStaticLength < MIN_STATIC_LENGTH) return null;

  // Count variables to know how many capture groups we need
  const varMatches = normalized.match(VARIABLE_PATTERN);
  if (!varMatches) return null;

  // Build regex: escape static parts, insert (.+?) for each variable
  const regexParts: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    // Escape regex special characters in static text
    regexParts.push(escapeRegex(parts[i]));

    // Add capture group for variable (if not the last part)
    if (i < varMatches.length) {
      regexParts.push('(.+?)');
    }
  }

  const pattern = regexParts.join('');
  // Normalize whitespace in the pattern (collapse multiple spaces to \s+)
  const normalizedPattern = pattern.replace(/\s+/g, '\\s+');

  return new RegExp(`^${normalizedPattern}$`);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compute how much of a template's static text (non-variable parts) appears in the DOM text.
 * Returns a score between 0 and 1.
 *
 * Used for ranking potential candidates from variable-containing templates.
 */
export function computeStaticOverlap(
  domText: string,
  template: string
): number {
  const stripped = stripHtmlTags(template);
  const normalized = normalizeWhitespace(stripped);

  if (!normalized) return 0;

  const parts = normalized.split(VARIABLE_PATTERN);
  const staticParts = parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (staticParts.length === 0) return 0;

  const totalStaticLength = staticParts.reduce(
    (sum, part) => sum + part.length,
    0
  );
  let matchedLength = 0;

  const domLower = domText.toLowerCase();
  for (const part of staticParts) {
    if (domLower.includes(part.toLowerCase())) {
      matchedLength += part.length;
    }
  }

  return matchedLength / totalStaticLength;
}

export { sortKeysByPageContext } from './memoryMapUtils';

/**
 * Pre-render all memoryMap entries into a lookup array.
 * Renders templates with variables so comparison uses the final text.
 */
function buildRenderedEntries(): {
  renderedText: string;
  contentKey: string;
  originalTemplate: string;
}[] {
  const entries: {
    renderedText: string;
    contentKey: string;
    originalTemplate: string;
  }[] = [];

  for (const [templateText, contentData] of window.memoryMap) {
    // Render template with variables (strips HTML + substitutes variables + normalizes whitespace)
    const rendered = renderTemplate(templateText, contentData.variables);

    for (const id of contentData.ids) {
      entries.push({
        renderedText: rendered,
        contentKey: id,
        originalTemplate: templateText,
      });
    }
  }

  return entries;
}

/**
 * Build pre-compiled regex patterns for all variable-containing templates in memoryMap.
 */
function buildTemplateRegexMap(): {
  regex: RegExp;
  contentKey: string;
  originalTemplate: string;
}[] {
  const regexEntries: {
    regex: RegExp;
    contentKey: string;
    originalTemplate: string;
  }[] = [];

  for (const [templateText, contentData] of window.memoryMap) {
    if (!hasVariables(templateText)) continue;

    const regex = templateToRegex(templateText);
    if (!regex) continue;

    for (const id of contentData.ids) {
      regexEntries.push({
        regex,
        contentKey: id,
        originalTemplate: templateText,
      });
    }
  }

  return regexEntries;
}

/** Deferred match awaiting prefix-based disambiguation */
interface DeferredMatch {
  domText: string;
  parentElement: HTMLElement;
  allKeys: string[];
  matchedTranslation: string;
}

/**
 * Scan the DOM for text nodes and match against memoryMap entries using a
 * deterministic 3-step pipeline with two-pass disambiguation:
 *
 * First pass:
 * 1. Exact match — O(1) hashmap lookup against memoryMap → score 1.0
 * 2. Template exact match — render templates with known variables → score 1.0
 * 3. Template pattern match — regex from {{var}} placeholders → score 1.0
 * Unambiguous matches (single ID) are assigned immediately.
 * Ambiguous matches (multiple IDs for same text) are deferred.
 *
 * Second pass:
 * Resolve deferred matches using prefix frequency from assigned keys.
 * All matching keys are returned in matchedKeys[], sorted best-first.
 *
 * For unmatched DOM text, discover potentialCandidates from variable templates
 * scored by static text overlap (computeStaticOverlap).
 *
 * Pattern matches add memoryMap aliases so existing highlighting code works unchanged.
 */
export function fuzzyMatchContent(
  options: FuzzyMatchOptions = {}
): FuzzyMatchResult[] {
  const candidateThreshold = options.candidateThreshold ?? 0.8;

  const nodes = findContentNodesInPage();
  const renderedEntries = buildRenderedEntries();
  const templateRegexEntries = buildTemplateRegexMap();
  const results: FuzzyMatchResult[] = [];
  const deferredMatches: DeferredMatch[] = [];

  // Track processed parent elements to avoid duplicates for fragmented text nodes
  const processedParents = new Set<HTMLElement>();
  // Track assigned content keys to prevent duplicates
  const assignedKeys = new Set<string>();

  // === FIRST PASS: match DOM text, assign unique matches, defer ambiguous ===

  for (const node of nodes) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) {
      continue;
    }

    const parentElement = node.parentElement;
    if (!parentElement) continue;

    if (processedParents.has(parentElement)) continue;

    const domText = normalizeWhitespace(
      getCleanTextContent(parentElement).trim()
    );
    if (!domText || domText.length < 2) continue;

    processedParents.add(parentElement);

    // Step 1: Try exact match (O(1) hashmap lookup)
    const exactMatch = window.memoryMap.get(domText);
    if (exactMatch) {
      const allKeys = Array.from(exactMatch.ids);
      const availableKeys = allKeys.filter((k) => !assignedKeys.has(k));
      const keysToConsider =
        availableKeys.length > 0 ? availableKeys : [allKeys[0]];

      if (keysToConsider.length === 1) {
        assignedKeys.add(keysToConsider[0]);
        results.push({
          text: domText,
          elementPath: getElementPath(parentElement),
          matchedKeys: keysToConsider,
          matchedTranslation: domText,
          matchScore: 1.0,
          potentialCandidates: [],
        });
      } else {
        deferredMatches.push({
          domText,
          parentElement,
          allKeys: keysToConsider,
          matchedTranslation: domText,
        });
      }
      continue;
    }

    // Step 2: Try rendered template exact match (handles variables with known values)
    let foundExact = false;
    for (const entry of renderedEntries) {
      if (assignedKeys.has(entry.contentKey)) continue;
      if (entry.renderedText === domText) {
        const allKeysForTemplate = renderedEntries
          .filter(
            (e) =>
              e.renderedText === domText && !assignedKeys.has(e.contentKey)
          )
          .map((e) => e.contentKey);

        if (allKeysForTemplate.length === 1) {
          assignedKeys.add(entry.contentKey);
          results.push({
            text: domText,
            elementPath: getElementPath(parentElement),
            matchedKeys: [entry.contentKey],
            matchedTranslation: entry.originalTemplate,
            matchScore: 1.0,
            potentialCandidates: [],
          });
        } else {
          deferredMatches.push({
            domText,
            parentElement,
            allKeys: allKeysForTemplate,
            matchedTranslation: entry.originalTemplate,
          });
        }
        foundExact = true;
        break;
      }
    }
    if (foundExact) continue;

    // Step 3: Try template pattern match (regex from variable placeholders)
    let patternMatch: {
      contentKey: string;
      originalTemplate: string;
    } | null = null;

    for (const entry of templateRegexEntries) {
      if (assignedKeys.has(entry.contentKey)) continue;
      if (entry.regex.test(domText)) {
        patternMatch = {
          contentKey: entry.contentKey,
          originalTemplate: entry.originalTemplate,
        };
        break;
      }
    }

    if (patternMatch) {
      const allPatternKeys = templateRegexEntries
        .filter(
          (e) => !assignedKeys.has(e.contentKey) && e.regex.test(domText)
        )
        .map((e) => e.contentKey);

      if (allPatternKeys.length === 1) {
        assignedKeys.add(patternMatch.contentKey);

        const existing = window.memoryMap.get(domText);
        if (existing) {
          existing.ids.add(patternMatch.contentKey);
        } else {
          window.memoryMap.set(domText, {
            ids: new Set([patternMatch.contentKey]),
            type: 'text',
          });
        }

        results.push({
          text: domText,
          elementPath: getElementPath(parentElement),
          matchedKeys: [patternMatch.contentKey],
          matchedTranslation: patternMatch.originalTemplate,
          matchScore: 1.0,
          potentialCandidates: [],
        });
      } else {
        deferredMatches.push({
          domText,
          parentElement,
          allKeys: allPatternKeys,
          matchedTranslation: patternMatch.originalTemplate,
        });
      }
      continue;
    }

    // Step 4: Candidate discovery for unmatched text
    const candidates: PotentialCandidate[] = [];

    for (const entry of renderedEntries) {
      if (assignedKeys.has(entry.contentKey)) continue;
      if (!hasVariables(entry.originalTemplate)) continue;

      const score = computeStaticOverlap(domText, entry.originalTemplate);

      if (score >= candidateThreshold) {
        candidates.push({
          contentKey: entry.contentKey,
          text: entry.originalTemplate,
          score,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    results.push({
      text: domText,
      elementPath: getElementPath(parentElement),
      matchedKeys: [],
      matchedTranslation: null,
      matchScore: 0,
      potentialCandidates: candidates,
    });
  }

  // === SECOND PASS: resolve deferred ambiguous matches using prefix frequency ===

  for (const deferred of deferredMatches) {
    const sortedKeys = sortKeysByPageContext(deferred.allKeys, assignedKeys);

    // Add best key to assignedKeys for subsequent deferred resolutions
    assignedKeys.add(sortedKeys[0]);

    // Add alias to memoryMap for pattern/template matches
    if (deferred.matchedTranslation !== deferred.domText) {
      const existing = window.memoryMap.get(deferred.domText);
      if (existing) {
        existing.ids.add(sortedKeys[0]);
      } else {
        window.memoryMap.set(deferred.domText, {
          ids: new Set([sortedKeys[0]]),
          type: 'text',
        });
      }
    }

    results.push({
      text: deferred.domText,
      elementPath: getElementPath(deferred.parentElement),
      matchedKeys: sortedKeys,
      matchedTranslation: deferred.matchedTranslation,
      matchScore: 1.0,
      potentialCandidates: [],
    });
  }

  return results;
}
