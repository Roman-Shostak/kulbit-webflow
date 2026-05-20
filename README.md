# Kulbit — Webflow Custom Scripts

Кастомні скрипти для сайту Kulbit на платформі Webflow.

## Стек

- GSAP + ScrollSmoother + Observer (snap-логіка замість fullpage.js)
- Webflow як no-code платформа
- GitHub + jsDelivr CDN для роздачі коду

## Структура

- `src/` — модулі коду (редагуються вручну)
- `dist/kulbit-main.js` — збірка для продакшну (підключається в Webflow)
- `build.js` — скрипт склеювання `src/*` → `dist/`
- `CLAUDE.md` — контекст проєкту для AI-асистентів

## Збірка

\`\`\`bash
node build.js
\`\`\`

## Підключення в Webflow

**Project Settings → Custom Code → Footer Code:**
\`\`\`html

<script src="https://cdn.jsdelivr.net/gh/USERNAME/kulbit-webflow@main/dist/kulbit-main.js"></script>

\`\`\`

## Cache-busting

Після пушу зайди на:
`https://purge.jsdelivr.net/gh/USERNAME/kulbit-webflow@main/dist/kulbit-main.js`

Це миттєво оновить кеш jsDelivr.
