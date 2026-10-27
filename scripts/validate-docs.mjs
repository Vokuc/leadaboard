#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔍 LeaderboardOS Documentation Integrity Validator');
console.log('==================================================');

let hasErrors = false;
let warningCount = 0;
let successCount = 0;

function reportError(msg) {
  console.error(`❌ ERROR: ${msg}`);
  hasErrors = true;
}

function reportWarn(msg) {
  console.warn(`⚠️ WARNING: ${msg}`);
  warningCount++;
}

function reportSuccess(msg) {
  console.log(`✅ ${msg}`);
  successCount++;
}

// 1. Verify existence of required core documentation files
const REQUIRED_FILES = [
  'docs/DOCUMENTATION_POLICY.md',
  'docs/FEATURE_DOCUMENTATION_CHECKLIST.md',
  'docs/feature-registry.json',
  'docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md',
  'docs/user/LEADERBOARDOS_USER_GUIDE.md'
];

for (const relPath of REQUIRED_FILES) {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    reportSuccess(`Required file exists: ${relPath}`);
  } else {
    reportError(`Missing required file: ${relPath}`);
  }
}

// 2. Verify ADR directory & files
const decisionsDir = path.join(rootDir, 'docs', 'technical', 'decisions');
if (fs.existsSync(decisionsDir)) {
  const adrs = fs.readdirSync(decisionsDir).filter(f => f.endsWith('.md'));
  if (adrs.length >= 5) {
    reportSuccess(`Architecture Decision Records: Found ${adrs.length} ADRs in docs/technical/decisions/`);
  } else {
    reportWarn(`Expected at least 5 ADRs in docs/technical/decisions/, found ${adrs.length}`);
  }
} else {
  reportError(`Missing ADR directory: docs/technical/decisions/`);
}

// 3. Verify Technical Bible required sections
const techBiblePath = path.join(rootDir, 'docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md');
if (fs.existsSync(techBiblePath)) {
  const content = fs.readFileSync(techBiblePath, 'utf-8');
  const REQUIRED_TECH_SECTIONS = [
    '1. Project Overview & Product Principles',
    '2. Architecture Overview',
    '3. Repository Map',
    '4. Domain Model & Database Reference',
    '5. Competition Engine Internals',
    '6. Authentication, Authorization & Security',
    '7. Business Logic & Important Workflows',
    '8. API, Integrations, Billing & Deployment',
    '9. Testing & Quality Standards',
    '10. Architecture Decisions & Engineering Conventions',
    '11. Known Limitations, Risks & Technical Debt',
    '12. The Seven-Era Technical Roadmap',
    '13. New Contributor & AI-Agent Onboarding'
  ];

  for (const sec of REQUIRED_TECH_SECTIONS) {
    // Check if section heading or normalized phrase exists
    const cleanSec = sec.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanContent = content.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanContent.includes(cleanSec)) {
      reportSuccess(`Technical Bible section verified: ${sec}`);
    } else {
      reportError(`Technical Bible missing required section: "${sec}"`);
    }
  }
}

// 4. Verify User Guide required sections
const userGuidePath = path.join(rootDir, 'docs/user/LEADERBOARDOS_USER_GUIDE.md');
if (fs.existsSync(userGuidePath)) {
  const content = fs.readFileSync(userGuidePath, 'utf-8');
  const REQUIRED_USER_SECTIONS = [
    '1. Welcome to LeaderboardOS',
    '2. First-Time Onboarding',
    '3. Organizer\'s Complete Guide',
    '4. Participant\'s Complete Guide',
    '5. Public Viewing, Discovery & Embeds',
    '6. Billing & Payments',
    '7. Troubleshooting & Frequently Asked Questions',
    '8. Feature Reference Matrix',
    '9. The Seven Eras Client Learning Journey',
    '10. Client Demonstration & Onboarding Playbook'
  ];

  for (const sec of REQUIRED_USER_SECTIONS) {
    const cleanSec = sec.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanContent = content.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanContent.includes(cleanSec)) {
      reportSuccess(`User Guide section verified: ${sec}`);
    } else {
      reportError(`User Guide missing required section: "${sec}"`);
    }
  }
}

// 5. Validate Feature Registry
const registryPath = path.join(rootDir, 'docs/feature-registry.json');
if (fs.existsSync(registryPath)) {
  try {
    const regData = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const VALID_STATUSES = new Set([
      'Implemented',
      'Partially implemented',
      'Planned',
      'Experimental',
      'Requires configuration',
      'Unverified'
    ]);
    const VALID_ERAS = new Set([
      'Era 1: Foundation',
      'Era 2: Organizer OS',
      'Era 3: Participant Network',
      'Era 4: Competition Marketplace',
      'Era 5: Infrastructure',
      'Era 6: Money',
      'Era 7: Global Competition Network'
    ]);

    if (!Array.isArray(regData.features)) {
      reportError('feature-registry.json: "features" must be an array');
    } else {
      reportSuccess(`feature-registry.json: Loaded ${regData.features.length} registered features`);
      for (const feat of regData.features) {
        if (!VALID_STATUSES.has(feat.status)) {
          reportError(`Feature "${feat.id}" has invalid status: "${feat.status}"`);
        }
        if (!VALID_ERAS.has(feat.roadmapEra)) {
          reportError(`Feature "${feat.id}" has invalid roadmapEra: "${feat.roadmapEra}"`);
        }
        // Validate primaryCodeLocations exist
        for (const loc of feat.primaryCodeLocations || []) {
          const locPath = path.join(rootDir, loc);
          if (!fs.existsSync(locPath)) {
            reportError(`Feature "${feat.id}" code path does not exist on disk: ${loc}`);
          }
        }
        // Validate relevantTests exist
        for (const testLoc of feat.relevantTests || []) {
          const testPath = path.join(rootDir, testLoc);
          if (!fs.existsSync(testPath)) {
            reportError(`Feature "${feat.id}" test path does not exist on disk: ${testLoc}`);
          }
        }
      }
    }
  } catch (err) {
    reportError(`feature-registry.json is invalid JSON: ${err.message}`);
  }
}

// 6. Check internal relative links in docs/
function validateMarkdownLinks(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const linkRegex = /\[([^\]]+)\]\((file:\/\/\/[^)]+|[^):]+?\.md)(#[^)]+)?\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    let target = match[2];
    if (target.startsWith('file:///')) {
      target = target.replace('file:///', '').replace(/\//g, path.sep);
      if (!fs.existsSync(target)) {
        reportError(`In ${path.relative(rootDir, filePath)}: Clickable file link does not exist: ${target}`);
      }
    } else if (target.endsWith('.md')) {
      const resolved = path.resolve(path.dirname(filePath), target);
      if (!fs.existsSync(resolved)) {
        reportError(`In ${path.relative(rootDir, filePath)}: Broken relative link to: ${target}`);
      }
    }
  }
}

const allDocs = [
  'docs/DOCUMENTATION_POLICY.md',
  'docs/FEATURE_DOCUMENTATION_CHECKLIST.md'
];

for (const d of allDocs) {
  const full = path.join(rootDir, d);
  if (fs.existsSync(full)) {
    validateMarkdownLinks(full);
  }
}

// 7. Validate Public Documentation Hub (content/docs/)
const publicDocsDir = path.join(rootDir, 'content', 'docs');
if (fs.existsSync(publicDocsDir)) {
  const docFiles = fs.readdirSync(publicDocsDir).filter(f => f.endsWith('.md'));
  if (docFiles.length >= 20) {
    reportSuccess(`Public Documentation Hub: Found ${docFiles.length} published articles in content/docs/`);
  } else {
    reportWarn(`Expected at least 20 articles in content/docs/, found ${docFiles.length}`);
  }

  const VALID_CATEGORIES = new Set([
    'Getting Started',
    'Leaderboards & Scoring',
    'League Tables',
    'Tournaments & Brackets',
    'Participants & Administration',
    'Sharing & Embeds',
    'Plans & Billing',
    'Troubleshooting & FAQ'
  ]);

  const allSlugs = new Set(docFiles.map(f => f.replace(/\.md$/, '')));

  for (const file of docFiles) {
    const fullPath = path.join(publicDocsDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Simple frontmatter extraction
    const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (!match) {
      reportError(`Public article ${file} is missing YAML frontmatter`);
      continue;
    }

    const frontmatter = match[1];
    const slugMatch = frontmatter.match(/slug:\s*["']?([^"'\r\n]+)["']?/);
    const titleMatch = frontmatter.match(/title:\s*["']?([^"'\r\n]+)["']?/);
    const catMatch = frontmatter.match(/category:\s*["']?([^"'\r\n]+)["']?/);
    const descMatch = frontmatter.match(/description:\s*["']?([^"'\r\n]+)["']?/);

    if (!slugMatch) reportError(`Public article ${file} missing slug`);
    if (!titleMatch) reportError(`Public article ${file} missing title`);
    if (!descMatch) reportError(`Public article ${file} missing description`);
    if (!catMatch) {
      reportError(`Public article ${file} missing category`);
    } else {
      const cat = catMatch[1].trim();
      if (!VALID_CATEGORIES.has(cat)) {
        reportError(`Public article ${file} has unrecognized category: "${cat}"`);
      }
    }

    // Check related slugs
    const relatedMatch = frontmatter.match(/related:\s*\[([^\]]*)\]/);
    if (relatedMatch) {
      const relSlugs = relatedMatch[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean);
      for (const rel of relSlugs) {
        if (!allSlugs.has(rel)) {
          reportError(`In ${file}: Related article slug does not exist: "${rel}"`);
        }
      }
    }

    // Check internal /docs/ links in markdown body
    const linkRegex = /\]\(\/docs\/([a-zA-Z0-9-]+)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      const targetSlug = linkMatch[1];
      if (!allSlugs.has(targetSlug)) {
        reportError(`In ${file}: Broken link to "/docs/${targetSlug}"`);
      }
    }
  }
} else {
  reportError('Missing public documentation directory: content/docs/');
}

console.log('--------------------------------------------------');
console.log(`Validation completed: ${successCount} checks passed, ${warningCount} warnings, ${hasErrors ? 'ERRORS FOUND' : '0 errors'}`);

if (hasErrors) {
  process.exit(1);
} else {
  console.log('🎉 All documentation checks passed successfully!');
  process.exit(0);
}
