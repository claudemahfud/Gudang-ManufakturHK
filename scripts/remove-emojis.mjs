import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'src', 'views');

function getFiles(d) {
  let res = [];
  fs.readdirSync(d, { withFileTypes: true }).forEach((f) => {
    const full = path.join(d, f.name);
    if (f.isDirectory()) res = res.concat(getFiles(full));
    else if (f.name.endsWith('.tsx')) res.push(full);
  });
  return res;
}

// Regex for emojis & specific pictorial symbols
const emojiMap = [
  // Titles with emojis
  { pattern: /📤\s*/g, replace: '' },
  { pattern: /📥\s*/g, replace: '' },
  { pattern: /❌\s*/g, replace: '' },
  { pattern: /🔄\s*/g, replace: '' },
  { pattern: /⚠️\s*/g, replace: '' },
  { pattern: /⚠\s*/g, replace: '' },
  { pattern: /🚚\s*/g, replace: '' },
  { pattern: /📋\s*/g, replace: '' },
  { pattern: /↩️?\s*/g, replace: '' },
  { pattern: /💰\s*/g, replace: '' },
  { pattern: /💸\s*/g, replace: '' },
  { pattern: /🏷️?\s*/g, replace: '' },
  { pattern: /👁️?\s*/g, replace: '' },
  { pattern: /🎯\s*/g, replace: '' },
  { pattern: /🚛\s*/g, replace: '' },
  { pattern: /📞\s*/g, replace: '' },
  { pattern: /👥\s*/g, replace: '' },
  { pattern: /📝\s*/g, replace: '' },
  { pattern: /📊\s*/g, replace: '' },
  { pattern: /📦\s*/g, replace: '' },
  { pattern: /📄\s*/g, replace: '' },
  { pattern: /🖨️?\s*/g, replace: '' },
  { pattern: /🗑️?\s*/g, replace: '' },
  { pattern: /🎉\s*/g, replace: '' },
  { pattern: /🚫\s*/g, replace: '' },
  { pattern: /📉\s*/g, replace: '' },
  { pattern: /🔍\s*/g, replace: '' },
  { pattern: /🥇\s*/g, replace: '' },
  { pattern: /🥈\s*/g, replace: '' },
  { pattern: /🥉\s*/g, replace: '' },
  { pattern: /✅\s*/g, replace: '' },
  { pattern: /🔐\s*/g, replace: '' },
  { pattern: /🏭\s*/g, replace: '' },
  { pattern: /🚪\s*/g, replace: '' },
  { pattern: /🔔\s*/g, replace: '' },
  { pattern: /👁\s*/g, replace: '' },
  { pattern: /🙈\s*/g, replace: '' },
];

const files = getFiles(dir);
let totalChanged = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  emojiMap.forEach(({ pattern, replace }) => {
    content = content.replace(pattern, replace);
  });

  // Also catch generic unicode emoji ranges
  const genericEmojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
  content = content.replace(genericEmojiRegex, '');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Cleaned emojis from: ${path.relative(process.cwd(), file)}`);
    totalChanged++;
  }
});

console.log(`\nFinished! Cleaned ${totalChanged} files.`);
