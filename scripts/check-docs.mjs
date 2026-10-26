#!/usr/bin/env node

/**
 * 文档结构检查：
 * 1. README.md 与 docs 目录下 Markdown 文件中的相对链接是否存在；
 * 2. Mermaid 代码块是否非空、是否闭合、是否以已知图表类型开头；
 * 3. ADR 索引是否覆盖所有 ADR 文件；
 * 4. 是否存在未被任何文档引用的孤立文档。
 *
 * 只依赖 Node 内置模块，CI 和本地都可以直接运行。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = join(ROOT, 'docs');
const ROOT_README = join(ROOT, 'README.md');
const ADR_DIR = join(DOCS_DIR, 'adr');
const ADR_INDEX = join(ADR_DIR, 'README.md');

const MERMAID_TYPES = new Set([
  'flowchart',
  'graph',
  'sequenceDiagram',
  'stateDiagram-v2',
  'stateDiagram',
  'classDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'C4Context',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
]);

const problems = [];
const warnings = [];
let linkCount = 0;
let mermaidCount = 0;
const referencedPaths = new Set();

function toPosix(path) {
  return path.split('\\').join('/');
}

function rel(path) {
  return toPosix(relative(ROOT, path));
}

function walkMarkdown(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkMarkdown(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(fullPath);
    }
  }
  return result;
}

function parseMarkdown(content) {
  const lines = content.split(/\r?\n/);
  const links = [];
  const mermaidBlocks = [];
  let fence = null;
  let mermaid = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      const info = fenceMatch[2].trim();

      if (!fence) {
        fence = { marker, info, start: index + 1 };
        if (info.split(/\s+/)[0] === 'mermaid') {
          mermaid = { lines: [], start: index + 1 };
        }
        continue;
      }

      if (
        marker[0] === fence.marker[0] &&
        marker.length >= fence.marker.length
      ) {
        if (mermaid) {
          mermaidBlocks.push({
            content: mermaid.lines.join('\n'),
            line: mermaid.start,
          });
          mermaid = null;
        }
        fence = null;
        continue;
      }
    }

    if (fence) {
      if (mermaid) {
        mermaid.lines.push(line);
      }
      continue;
    }

    // 跳过行内代码，避免把示例里的 [text](path) 当成真实链接。
    const withoutInlineCode = line.replace(/`[^`]*`/g, '');
    const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(withoutInlineCode)) !== null) {
      links.push({ raw: match[1], line: index + 1 });
    }
  }

  return {
    links,
    mermaidBlocks,
    unclosedFence: fence,
  };
}

function normalizeTarget(raw) {
  let target = raw.trim();

  if (target.startsWith('<')) {
    const end = target.indexOf('>');
    target = end >= 0 ? target.slice(1, end) : target.slice(1);
  } else {
    target = target.split(/\s+/)[0];
  }

  if (!target) {
    return null;
  }

  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) {
    return null;
  }

  if (target.startsWith('#')) {
    return null;
  }

  const withoutFragment = target.split('#')[0].split('?')[0];
  if (!withoutFragment) {
    return null;
  }

  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

function checkLink(file, raw, line) {
  const target = normalizeTarget(raw);
  if (!target) {
    return;
  }

  linkCount += 1;
  const resolved = resolve(dirname(file), target);

  if (!existsSync(resolved)) {
    problems.push(
      `${rel(file)}:${line} 相对链接不存在 -> ${raw}`,
    );
    return;
  }

  if (!statSync(resolved).isFile()) {
    problems.push(
      `${rel(file)}:${line} 相对链接指向的不是文件 -> ${raw}`,
    );
    return;
  }

  referencedPaths.add(resolved);
}

function checkMermaid(file, block) {
  mermaidCount += 1;
  const content = block.content.trim();

  if (!content) {
    problems.push(`${rel(file)}:${block.line} Mermaid 代码块为空`);
    return;
  }

  const firstLine = content.split(/\r?\n/).find((line) => line.trim());
  const firstToken = firstLine?.trim().split(/[\s{(]/)[0];

  if (!firstToken || !MERMAID_TYPES.has(firstToken)) {
    warnings.push(
      `${rel(file)}:${block.line} Mermaid 图表类型未识别（首行：${firstLine ?? '空'}）`,
    );
  }
}

function checkAdrIndex() {
  if (!existsSync(ADR_INDEX)) {
    problems.push('docs/adr/README.md 不存在');
    return;
  }

  const indexContent = readFileSync(ADR_INDEX, 'utf8');
  const adrFiles = existsSync(ADR_DIR)
    ? readdirSync(ADR_DIR, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith('.md') &&
            entry.name !== 'README.md',
        )
        .map((entry) => entry.name)
    : [];

  for (const fileName of adrFiles) {
    if (!indexContent.includes(fileName)) {
      problems.push(`docs/adr/README.md 未索引 ${fileName}`);
    }
  }
}

function checkOrphans(files) {
  for (const file of files) {
    if (file === ROOT_README || file === join(DOCS_DIR, 'README.md')) {
      continue;
    }
    if (!referencedPaths.has(resolve(file))) {
      warnings.push(`${rel(file)} 未被任何文档链接引用`);
    }
  }
}

const files = [
  ...(existsSync(ROOT_README) ? [ROOT_README] : []),
  ...walkMarkdown(DOCS_DIR),
];

if (!files.length) {
  problems.push('没有找到任何 Markdown 文档');
}

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const parsed = parseMarkdown(content);

  if (parsed.unclosedFence) {
    problems.push(
      `${rel(file)}:${parsed.unclosedFence.start} 代码块未闭合（${parsed.unclosedFence.marker}）`,
    );
  }

  for (const link of parsed.links) {
    checkLink(file, link.raw, link.line);
  }

  for (const block of parsed.mermaidBlocks) {
    checkMermaid(file, block);
  }
}

checkAdrIndex();
checkOrphans(files);

console.log('文档检查');
console.log(`  文件：${files.length}`);
console.log(`  相对链接：${linkCount}`);
console.log(`  Mermaid 图：${mermaidCount}`);

if (warnings.length) {
  console.log('\n警告：');
  for (const warning of warnings) {
    console.log(`  ! ${warning}`);
  }
}

if (problems.length) {
  console.error('\n错误：');
  for (const problem of problems) {
    console.error(`  x ${problem}`);
  }
  process.exit(1);
}

console.log('\n✓ 相对链接、Mermaid 代码块、ADR 索引检查通过');
