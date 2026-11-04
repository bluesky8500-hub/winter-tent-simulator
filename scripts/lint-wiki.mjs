import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('wiki');
const required = ['index.md', 'overview.md', 'log.md', 'AGENTS.md'];
const errors = [];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`필수 파일 없음: ${file}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root).filter((file) => file.endsWith('.md'));
const relFiles = new Set(files.map((file) => path.relative(root, file).replaceAll('\\', '/')));

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const content = fs.readFileSync(file, 'utf8');
  if (rel !== 'AGENTS.md' && !content.startsWith('---\n')) errors.push(`frontmatter 없음: ${rel}`);
  if (/[A-Za-z]:\\|file:\/\//i.test(content)) errors.push(`절대 로컬 경로 사용: ${rel}`);
  if (/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9_]{20,}/.test(content)) {
    errors.push(`비밀정보 패턴: ${rel}`);
  }

  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const raw = match[1].split('|')[0].split('#')[0].trim();
    if (!raw) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), raw)) + (raw.endsWith('.md') ? '' : '.md');
    if (!relFiles.has(target)) errors.push(`깨진 위키 링크: ${rel} -> ${raw}`);
  }
}

const log = fs.readFileSync(path.join(root, 'log.md'), 'utf8');
for (const line of log.split(/\r?\n/).filter((line) => line.startsWith('## ['))) {
  if (!/^## \[\d{4}-\d{2}-\d{2}\] (ingest|query|lint|decision) \| .+/.test(line)) {
    errors.push(`로그 형식 오류: ${line}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`위키 검사 통과: ${files.length}개 Markdown, 깨진 링크 0`);
