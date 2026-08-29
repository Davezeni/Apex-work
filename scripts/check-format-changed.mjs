import { execFileSync } from 'node:child_process';

const formatExtensions = /\.(?:ts|tsx|js|jsx|mjs|json|md|css)$/i;

function git(args, allowFailure = false) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

function changedFiles() {
  const files = new Set();
  const baseRef = process.env.GITHUB_BASE_REF;
  let base = '';

  if (baseRef) {
    base = git(['merge-base', 'HEAD', `origin/${baseRef}`], true);
  }
  if (!base) base = git(['rev-parse', 'HEAD^'], true);

  if (base) {
    for (const file of git(['diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD']).split(
      '\n',
    )) {
      if (file) files.add(file);
    }
  } else {
    for (const file of git(['ls-files']).split('\n')) {
      if (file) files.add(file);
    }
  }

  // Include local work-in-progress files when this script is run manually.
  for (const file of git(['diff', '--name-only', '--diff-filter=ACMR']).split('\n')) {
    if (file) files.add(file);
  }
  for (const file of git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n')) {
    if (file) files.add(file);
  }
  for (const file of git(['ls-files', '--others', '--exclude-standard']).split('\n')) {
    if (file) files.add(file);
  }

  return [...files].filter((file) => formatExtensions.test(file));
}

const files = changedFiles();
if (files.length === 0) {
  console.log('No changed source/document files require formatting checks.');
  process.exit(0);
}

console.log(`Checking Prettier formatting for ${files.length} changed file(s)…`);
const prettier = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(prettier, ['prettier', '--check', ...files], { stdio: 'inherit' });
