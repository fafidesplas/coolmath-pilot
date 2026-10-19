#!/usr/bin/env node
// Builds status.json for the dashboard: game info from each CLAUDE.md,
// owner/stage from games.json, and progress from git history.
// Usage: node scripts/build-status.mjs   (run from anywhere inside the repo)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEP = '\x1f';

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function parseCommits(out) {
  if (!out) return [];
  return out.split('\n').map(line => {
    const [hash, author, date, subject] = line.split(SEP);
    return { hash, short: hash.slice(0, 7), author, date, subject };
  });
}

function log(path, n) {
  const args = ['log', `--format=%H${SEP}%an${SEP}%cI${SEP}%s`];
  if (n) args.push(`-n${n}`);
  if (path) args.push('--', path);
  return parseCommits(git(...args));
}

function repoUrl() {
  if (process.env.GITHUB_REPOSITORY) {
    return `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}`;
  }
  const remote = git('remote', 'get-url', 'origin');
  const m = remote.match(/github\.com[:/](.+?)(\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}

function readBrief(slug) {
  const text = readFileSync(join(root, 'games', slug, 'CLAUDE.md'), 'utf8');
  const name = (text.match(/^#\s+(.+?)\s+—/m) || [])[1] || slug;
  const tagline = (text.match(/^>\s+(.+)$/m) || [])[1] || '';
  const field = key => (text.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([^·\\n]+)`)) || [])[1]?.trim() || '';
  return {
    name,
    tagline,
    rank: parseInt(field('Rank').replace('#', ''), 10) || null,
    genre: field('Genre'),
    family: field('Art family'),
    habit: field('Audience habit').replace(/\s*\(.*\)$/, ''),
  };
}

// Latest "## ..." section of DEVLOG.md (newest entry goes on top).
function readDevlog(slug) {
  const file = join(root, 'games', slug, 'DEVLOG.md');
  if (!existsSync(file)) return null;
  const sections = readFileSync(file, 'utf8').split(/^##\s+/m).slice(1);
  if (!sections.length) return null;
  const [title, ...body] = sections[0].split('\n');
  const lines = body.map(l => l.trim()).filter(Boolean).slice(0, 6);
  return { title: title.trim(), lines };
}

const manifest = JSON.parse(readFileSync(join(root, 'games.json'), 'utf8'));

const games = manifest.games.map(g => {
  const dir = `games/${g.slug}`;
  const commits = log(dir);
  return {
    slug: g.slug,
    owner: g.owner,
    stage: g.stage || 'brief',
    ...readBrief(g.slug),
    playable: existsSync(join(root, dir, 'index.html')),
    commitCount: commits.length,
    lastCommit: commits[0] || null,
    firstCommit: commits.at(-1) || null,
    devlog: readDevlog(g.slug),
  };
});

const status = {
  generatedAt: new Date().toISOString(),
  repoUrl: repoUrl(),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD') || null,
  head: log(null, 1)[0] || null,
  recent: log('games', 15),
  games,
};

writeFileSync(join(root, 'status.json'), JSON.stringify(status, null, 2) + '\n');
console.log(`status.json: ${games.length} games, ${games.filter(g => g.playable).length} playable`);
