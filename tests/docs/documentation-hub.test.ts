import { describe, it, expect } from 'vitest';
import { 
  getAllDocs, 
  getDocBySlug, 
  getCategories, 
  getAdjacentDocs, 
  searchDocs,
  extractHeadings
} from '@/lib/docs/api';

describe('Public Documentation Hub API', () => {
  it('loads all published articles from content/docs', () => {
    const docs = getAllDocs();
    expect(docs.length).toBeGreaterThanOrEqual(20);
    
    // Check first doc structure
    const sample = docs[0];
    expect(sample).toHaveProperty('slug');
    expect(sample).toHaveProperty('title');
    expect(sample).toHaveProperty('description');
    expect(sample).toHaveProperty('category');
    expect(sample).toHaveProperty('content');
    expect(sample).toHaveProperty('headings');
  });

  it('retrieves an individual article by slug with parsed headings', () => {
    const doc = getDocBySlug('what-is-leaderboardos');
    expect(doc).not.toBeNull();
    expect(doc?.title).toBe('What is LeaderboardOS?');
    expect(doc?.category).toBe('Getting Started');
    expect(doc?.headings.length).toBeGreaterThan(0);
  });

  it('returns null for nonexistent article slug', () => {
    const doc = getDocBySlug('this-article-definitely-does-not-exist');
    expect(doc).toBeNull();
  });

  it('groups articles into canonical categories', () => {
    const categories = getCategories();
    expect(categories.length).toBeGreaterThanOrEqual(8);

    const gettingStarted = categories.find(c => c.id === 'getting-started');
    expect(gettingStarted).toBeDefined();
    expect(gettingStarted?.articles.length).toBeGreaterThanOrEqual(4);
  });

  it('computes adjacent navigation (previous and next articles)', () => {
    const allDocs = getAllDocs();
    const secondDoc = allDocs[1];
    
    const { previous, next } = getAdjacentDocs(secondDoc.slug);
    expect(previous?.slug).toBe(allDocs[0].slug);
    if (allDocs.length > 2) {
      expect(next?.slug).toBe(allDocs[2].slug);
    }
  });

  it('performs accurate in-memory keyword search with snippets', () => {
    const results = searchDocs('league table');
    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult).toHaveProperty('title');
    expect(topResult).toHaveProperty('snippet');
    expect(topResult.score).toBeGreaterThan(0);
  });

  it('filters search results by category when specified', () => {
    const results = searchDocs('tournament', 'Tournaments & Brackets');
    expect(results.length).toBeGreaterThan(0);
    results.forEach(res => {
      expect(res.category).toBe('Tournaments & Brackets');
    });
  });

  it('returns empty array when search query has no matches', () => {
    const results = searchDocs('xyzsupercalifragilistic123456');
    expect(results).toEqual([]);
  });

  it('extracts and slugifies markdown headings correctly', () => {
    const markdown = `
# Title (Ignored because level 1)
## Step 1: Initialize Competition
Some text
### Sub-step: Choose Template
More text
## Final Whistle
`;
    const headings = extractHeadings(markdown);
    expect(headings.length).toBe(3);
    expect(headings[0]).toEqual({
      id: 'step-1-initialize-competition',
      text: 'Step 1: Initialize Competition',
      level: 2,
    });
    expect(headings[1]).toEqual({
      id: 'sub-step-choose-template',
      text: 'Sub-step: Choose Template',
      level: 3,
    });
    expect(headings[2]).toEqual({
      id: 'final-whistle',
      text: 'Final Whistle',
      level: 2,
    });
  });
});
