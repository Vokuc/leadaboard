import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface DocHeading {
  id: string;
  text: string;
  level: number;
}

export interface DocArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  order: number;
  readTime: string;
  lastUpdated: string;
  tags: string[];
  related: string[];
  content: string;
  headings: DocHeading[];
}

export interface DocCategory {
  id: string;
  name: string;
  description: string;
  iconName: string;
  articles: DocArticle[];
}

export interface SearchResult {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  snippet: string;
  score: number;
}

const docsDirectory = path.join(process.cwd(), 'content', 'docs');

// Ensure directory exists
if (!fs.existsSync(docsDirectory)) {
  fs.mkdirSync(docsDirectory, { recursive: true });
}

export const CANONICAL_CATEGORIES = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the fundamentals of LeaderboardOS and launch your first competition in minutes.',
    iconName: 'Rocket',
  },
  {
    id: 'leaderboards-and-scoring',
    name: 'Leaderboards & Scoring',
    description: 'Understand continuous points scoring, custom rules, bonuses, and realtime ranking updates.',
    iconName: 'Trophy',
  },
  {
    id: 'league-tables',
    name: 'League Tables',
    description: 'Run round-robin leagues with automated scheduling, fixtures, standings, and goal differentials.',
    iconName: 'Table',
  },
  {
    id: 'tournaments-and-brackets',
    name: 'Tournaments & Brackets',
    description: 'Build single-elimination brackets, manage seeds, resolve ties, and connect group stages to playoffs.',
    iconName: 'GitBranch',
  },
  {
    id: 'participants-and-administration',
    name: 'Participants & Administration',
    description: 'Manage competitor passports, team rosters, staff roles, and live matchday referee operations.',
    iconName: 'Users',
  },
  {
    id: 'sharing-and-embeds',
    name: 'Sharing & Embeds',
    description: 'Display live spectator podiums, generate venue QR codes, and embed widgets on external sites.',
    iconName: 'Share2',
  },
  {
    id: 'plans-and-billing',
    name: 'Plans & Billing',
    description: 'Learn about SaaS subscription tiers, collecting entry fees via Paystack, and prize allocations.',
    iconName: 'CreditCard',
  },
  {
    id: 'troubleshooting-and-faq',
    name: 'Troubleshooting & FAQ',
    description: 'Answers to frequently asked questions and troubleshooting steps for scores, embeds, and access.',
    iconName: 'HelpCircle',
  },
];

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function extractHeadings(markdown: string): DocHeading[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: DocHeading[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugifyHeading(text);
    headings.push({ id, text, level });
  }

  return headings;
}

export function getDocSlugs(): string[] {
  if (!fs.existsSync(docsDirectory)) return [];
  return fs.readdirSync(docsDirectory).filter(file => file.endsWith('.md'));
}

export function getDocBySlug(slug: string): DocArticle | null {
  const realSlug = slug.replace(/\.md$/, '');
  const fullPath = path.join(docsDirectory, `${realSlug}.md`);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  const headings = extractHeadings(content);

  return {
    slug: realSlug,
    title: data.title || realSlug,
    description: data.description || '',
    category: data.category || 'Getting Started',
    order: typeof data.order === 'number' ? data.order : 99,
    readTime: data.readTime || '3 min read',
    lastUpdated: data.lastUpdated || '2026-10-27',
    tags: Array.isArray(data.tags) ? data.tags : [],
    related: Array.isArray(data.related) ? data.related : [],
    content,
    headings,
  };
}

export function getAllDocs(): DocArticle[] {
  const slugs = getDocSlugs();
  const docs = slugs
    .map(slug => getDocBySlug(slug))
    .filter((doc): doc is DocArticle => doc !== null)
    .sort((a, b) => {
      if (a.category === b.category) {
        return a.order - b.order;
      }
      return a.category.localeCompare(b.category);
    });

  return docs;
}

export function getCategories(): DocCategory[] {
  const allDocs = getAllDocs();

  return CANONICAL_CATEGORIES.map(cat => {
    const articles = allDocs
      .filter(doc => doc.category.toLowerCase().replace(/[^a-z0-9]/g, '') === cat.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .sort((a, b) => a.order - b.order);

    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      iconName: cat.iconName,
      articles,
    };
  }).filter(cat => cat.articles.length > 0);
}

export function getAdjacentDocs(slug: string): { previous: DocArticle | null; next: DocArticle | null } {
  const allDocs = getAllDocs();
  const currentIndex = allDocs.findIndex(doc => doc.slug === slug);

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  const previous = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
  const next = currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null;

  return { previous, next };
}

export function searchDocs(query: string, categoryFilter?: string): SearchResult[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const allDocs = getAllDocs();
  const results: SearchResult[] = [];

  for (const doc of allDocs) {
    if (categoryFilter && doc.category.toLowerCase() !== categoryFilter.toLowerCase()) {
      continue;
    }

    let score = 0;
    const lowerTitle = doc.title.toLowerCase();
    const lowerDesc = doc.description.toLowerCase();
    const lowerContent = doc.content.toLowerCase();
    const lowerTags = doc.tags.map(t => t.toLowerCase()).join(' ');

    for (const term of terms) {
      if (lowerTitle.includes(term)) {
        score += 15;
      }
      if (lowerTags.includes(term)) {
        score += 8;
      }
      if (lowerDesc.includes(term)) {
        score += 5;
      }
      if (lowerContent.includes(term)) {
        score += 2;
      }
    }

    if (score > 0) {
      // Extract a contextual snippet around the first matched term
      let snippet = doc.description;
      const firstTerm = terms[0];
      const termIdx = lowerContent.indexOf(firstTerm);

      if (termIdx !== -1) {
        const start = Math.max(0, termIdx - 60);
        const end = Math.min(doc.content.length, termIdx + 120);
        const rawSnippet = doc.content.slice(start, end).replace(/[#*`_\[\]()]/g, '');
        snippet = `...${rawSnippet.trim()}...`;
      }

      results.push({
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        readTime: doc.readTime,
        snippet,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
