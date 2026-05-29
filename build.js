// ====================================================================
// build.js — Простий скрипт збірки src/* → dist/kulbit-main.js
// Запуск: node build.js
// dist — ПРОДАКШН-бандл: коментарі та console.* зачищаються (src лишається
//        документованим, CLAUDE.md §7). Стрипер — токенайзер без залежностей:
//        коректно розрізняє рядки / шаблони / regex / коментарі.
// ====================================================================

const fs = require('fs');
const path = require('path');

const SRC_DIR = './src';
const DIST_DIR = './dist';
const DIST_FILE = path.join(DIST_DIR, 'kulbit-main.js');

console.log('[Build] === Старт збірки Kulbit ===');

// ── Пропустити збалансовані дужки від '(' (для вирізання console.*(...)).
//    Усередині поважає рядки / шаблони / коментарі.
function skipBalanced(src, start) {
  let i = start, depth = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { i += 2; while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') { const q = c; i++; while (i < n) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === q) { i++; break; } i++; } continue; }
    if (c === '`') { i++; let d = 0; while (i < n) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '`' && d === 0) { i++; break; } if (src[i] === '$' && src[i + 1] === '{') { d++; i += 2; continue; } if (src[i] === '}' && d > 0) { d--; i++; continue; } i++; } continue; }
    if (c === '(') { depth++; i++; continue; }
    if (c === ')') { depth--; i++; if (depth === 0) return i; continue; }
    i++;
  }
  return i;
}

// ── Зачистка для продакшну: прибрати коментарі та console.* стейтменти.
function stripForProd(src) {
  let out = '';
  let prev = ''; // останній значущий (не-пробіл) символ у out — для детекції regex vs ділення
  const n = src.length;
  let i = 0;
  const KW = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'yield', 'await', 'case'];
  const regexAllowed = () => {
    if (prev === '') return true;
    if ('(,=:[!&|?{};+-*%^~<>'.includes(prev)) return true;
    const m = out.match(/([A-Za-z_$]+)\s*$/);
    return !!(m && KW.includes(m[1]));
  };
  const emit = (s) => { out += s; for (let k = s.length - 1; k >= 0; k--) { if (!/\s/.test(s[k])) { prev = s[k]; break; } } };

  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    // коментарі — викидаємо
    if (c === '/' && c2 === '/') { i += 2; while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    // рядки '...' "..."
    if (c === "'" || c === '"') {
      const q = c; let s = c; i++;
      while (i < n) { s += src[i]; if (src[i] === '\\') { s += src[i + 1] || ''; i += 2; continue; } if (src[i] === q) { i++; break; } i++; }
      emit(s); continue;
    }
    // шаблонні літерали `...${...}...`
    if (c === '`') {
      let s = '`'; i++; let d = 0;
      while (i < n) { if (src[i] === '\\') { s += src[i] + (src[i + 1] || ''); i += 2; continue; } if (src[i] === '`' && d === 0) { s += '`'; i++; break; } if (src[i] === '$' && src[i + 1] === '{') { d++; s += '${'; i += 2; continue; } if (src[i] === '}' && d > 0) { d--; s += '}'; i++; continue; } s += src[i]; i++; }
      emit(s); continue;
    }
    // regex-літерали /.../flags (лише там, де синтаксично дозволено)
    if (c === '/' && regexAllowed()) {
      let s = '/'; i++; let inClass = false;
      while (i < n) { s += src[i]; if (src[i] === '\\') { s += src[i + 1] || ''; i += 2; continue; } if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false; else if (src[i] === '/' && !inClass) { i++; break; } i++; }
      while (i < n && /[a-z]/i.test(src[i])) { s += src[i]; i++; }
      emit(s); continue;
    }
    // console.<method>(...) — окремий стейтмент: вирізаємо разом із трейлінг ';'
    if (c === 'c' && src.startsWith('console', i) && !/[\w$.]/.test(src[i - 1] || '')) {
      let k = i + 7; while (k < n && /\s/.test(src[k])) k++;
      if (src[k] === '.') {
        k++; while (k < n && /\s/.test(src[k])) k++;
        let m = k; while (m < n && /[\w$]/.test(src[m])) m++;
        let p = m; while (p < n && /\s/.test(src[p])) p++;
        if (src[p] === '(') {
          let q = skipBalanced(src, p);
          const standalone = (prev === ';' || prev === '{' || prev === '}' || prev === '');
          if (standalone) {
            while (q < n && (src[q] === ' ' || src[q] === '\t')) q++;
            if (src[q] === ';') q++;
            i = q; continue; // окремий стейтмент -> повністю видалено
          }
          emit('void 0'); // console усередині виразу (arrow-body / && / ?:) -> валідний no-op
          i = q; continue;
        }
      }
    }
    out += c; if (!/\s/.test(c)) prev = c; i++;
  }
  return out;
}

// Беремо всі .js файли з src/ і сортуємо за іменем
const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).sort();
if (files.length === 0) { console.error('[Build] ❌ Немає файлів у src/'); process.exit(1); }
console.log(`[Build] Знайдено файлів: ${files.length}`);

// Прапорець: --prod -> чистий прод-бандл (без коментарів/console); без прапорця -> dev (з логами)
const PROD = process.argv.includes('--prod');

// Склеюємо сирий код
const raw = files
  .map((file) => { console.log(`[Build] + ${file}`); return fs.readFileSync(path.join(SRC_DIR, file), 'utf8'); })
  .join('\n\n');

// Прод-режим: зачистити коментарі+console; dev-режим: лишити як є (для тестування)
const output = PROD
  ? stripForProd(raw)
      .replace(/[ \t]+$/gm, '')   // трейлінг-пробіли
      .replace(/\n{3,}/g, '\n\n') // 3+ порожніх рядки → 1
      .replace(/^\s+\n/, '')      // зайвий старт
  : raw;

// Перевірка синтаксису — НЕ перезаписуємо dist, якщо щось зламано
try {
  new Function(output);
} catch (e) {
  console.error('[Build] ❌ Синтаксична помилка у бандлі:', e.message);
  console.error('[Build] dist НЕ оновлено.' + (PROD ? ' Перевір токенайзер у build.js.' : ''));
  process.exit(1);
}

const timestamp = new Date().toISOString();
const banner = PROD
  ? `/* Kulbit Webflow — production bundle — ${timestamp} */\n`
  : `/* Kulbit Webflow — dev build (з логами) — ${timestamp} */\n\n`;

if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR);
fs.writeFileSync(DIST_FILE, banner + output);

// Статистика
const rawKB = (Buffer.byteLength(raw, 'utf8') / 1024).toFixed(2);
const outKB = (fs.statSync(DIST_FILE).size / 1024).toFixed(2);
console.log(`[Build] ✅ Готово (${PROD ? 'PROD' : 'DEV'}): ${DIST_FILE}`);
console.log(`[Build] Розмір: ${outKB} KB${PROD ? ` (сирий src ${rawKB} KB)` : ''}`);
if (PROD) {
  const consoleLeft = (output.match(/console\.(log|warn|error|info|debug)\s*\(/g) || []).length;
  console.log(`[Build] console.* у бандлі: ${consoleLeft} (має бути 0)`);
} else {
  console.log('[Build] DEV: коментарі+console збережено. Прод-бандл: node build.js --prod');
}
