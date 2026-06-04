// ====================================================================
// build.js — Збірка src/* → ДВІ версії в dist/ (CLAUDE.md §9):
//   • kulbit-main.js      — DEV  (коментарі + console.* збережено) — розробка/тести/staging
//   • kulbit-main.min.js  — PROD (коментарі + console.* зачищено)  — продакшн
// Запуск: node build.js         → будує ОБИДВІ версії
//         node build.js --dev   → лише DEV
//         node build.js --prod  → лише PROD
// Прод-стрипер — токенайзер без залежностей (коректно розрізняє рядки/шаблони/regex/коментарі).
// src/ ЗАВЖДИ лишається документованим (укр-коментарі+логи, §7/§8) — зачистка лише у прод-файлі.
// ====================================================================

const fs = require('fs');
const path = require('path');

const SRC_DIR = './src';
const DIST_DIR = './dist';
const DEV_FILE = path.join(DIST_DIR, 'kulbit-main.js');
const PROD_FILE = path.join(DIST_DIR, 'kulbit-main.min.js');

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

// Прапорці: за замовчуванням будуємо ОБИДВІ версії; --dev / --prod → лише одну
const onlyDev = process.argv.includes('--dev');
const onlyProd = process.argv.includes('--prod');
const doDev = !onlyProd;
const doProd = !onlyDev;

// Склеюємо сирий код (один раз)
const raw = files
  .map((file) => { console.log(`[Build] + ${file}`); return fs.readFileSync(path.join(SRC_DIR, file), 'utf8'); })
  .join('\n\n');

const rawKB = (Buffer.byteLength(raw, 'utf8') / 1024).toFixed(2);
const timestamp = new Date().toISOString();
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR);

// ── Зібрати, перевірити синтаксис і записати одну версію (prod=true → зачистка)
function writeBundle(prod) {
  const output = prod
    ? stripForProd(raw)
        .replace(/[ \t]+$/gm, '')   // трейлінг-пробіли
        .replace(/\n{3,}/g, '\n\n') // 3+ порожніх рядки → 1
        .replace(/^\s+\n/, '')      // зайвий старт
    : raw;

  // Перевірка синтаксису — НЕ записуємо файл, якщо щось зламано
  try {
    new Function(output);
  } catch (e) {
    console.error(`[Build] ❌ Синтаксична помилка (${prod ? 'PROD' : 'DEV'}):`, e.message);
    console.error('[Build] Файл НЕ оновлено.' + (prod ? ' Перевір токенайзер у build.js.' : ''));
    process.exit(1);
  }

  const banner = prod
    ? `/* Kulbit Webflow — production bundle — ${timestamp} */\n`
    : `/* Kulbit Webflow — dev build (з логами) — ${timestamp} */\n\n`;
  const file = prod ? PROD_FILE : DEV_FILE;
  fs.writeFileSync(file, banner + output);

  const outKB = (fs.statSync(file).size / 1024).toFixed(2);
  console.log(`[Build] ✅ ${prod ? 'PROD' : 'DEV '} → ${file}  (${outKB} KB)`);
  if (prod) {
    const consoleLeft = (output.match(/console\.(log|warn|error|info|debug)\s*\(/g) || []).length;
    console.log(`[Build]      console.* у прод-бандлі: ${consoleLeft} (має бути 0)`);
  }
}

if (doDev) writeBundle(false);
if (doProd) writeBundle(true);
console.log(`[Build] === Готово (сирий src ${rawKB} KB) ===`);
