// ====================================================================
// build.js — Простий скрипт збірки src/* → dist/kulbit-main.js
// Запуск: node build.js
// ====================================================================

const fs = require('fs');
const path = require('path');

const SRC_DIR = './src';
const DIST_DIR = './dist';
const DIST_FILE = path.join(DIST_DIR, 'kulbit-main.js');

console.log('[Build] === Старт збірки Kulbit ===');

// Беремо всі .js файли з src/ і сортуємо за іменем
const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => f.endsWith('.js'))
  .sort();

if (files.length === 0) {
  console.error('[Build] ❌ Немає файлів у src/');
  process.exit(1);
}

console.log(`[Build] Знайдено файлів: ${files.length}`);

// Склеюємо
const timestamp = new Date().toISOString();
const banner = `/* Kulbit Webflow — зібрано ${timestamp} */\n\n`;

const content = files
  .map((file) => {
    const fullPath = path.join(SRC_DIR, file);
    console.log(`[Build] + ${file}`);
    return fs.readFileSync(fullPath, 'utf8');
  })
  .join('\n\n');

// Записуємо в dist/
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR);
}
fs.writeFileSync(DIST_FILE, banner + content);

const sizeKB = (fs.statSync(DIST_FILE).size / 1024).toFixed(2);
console.log(`[Build] ✅ Готово: ${DIST_FILE}`);
console.log(`[Build] Розмір: ${sizeKB} KB`);
