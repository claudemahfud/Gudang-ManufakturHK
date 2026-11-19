import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const zipFile = 'C:\\Users\\HIKIMORI\\.gemini\\antigravity\\brain\\e1bd5cdc-c304-46fa-8fe4-66aa6ca973fd\\.user_uploaded\\media_1795068454015_8643ed7c.zip';
const targetDir = 'C:\\Users\\HIKIMORI\\.gemini\\antigravity\\brain\\e1bd5cdc-c304-46fa-8fe4-66aa6ca973fd\\scratch\\srasa-book';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Extract using tar (Windows 10/11 built-in)
console.log('Extracting zip...');
execSync(`tar -xf "${zipFile}" -C "${targetDir}"`);

console.log('Extraction complete. Reading structure...');
function walk(dir, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = fullPath.replace(targetDir, '');
    files.push({ path: relPath, isDir: entry.isDirectory() });
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      files = files.concat(walk(fullPath, maxDepth, currentDepth + 1));
    }
  }
  return files;
}

const list = walk(targetDir);
console.log(`Found ${list.length} items. First 60:`);
console.log(list.slice(0, 60).map(i => (i.isDir ? '[DIR] ' : '      ') + i.path).join('\n'));
