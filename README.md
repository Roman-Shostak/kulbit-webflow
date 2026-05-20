# Kulbit — Webflow Custom Scripts

Кастомні скрипти для сайту Kulbit на платформі Webflow.

## Розробка нового модуля

```bash
# 1. Відкрий проєкт
cd ~/Projects/kulbit-webflow
cursor .  # або code .

# 2. Запусти Claude Code (в окремому терміналі або вкладці)
claude

# 3. Опиши Claude що треба зробити, отримай код
# 4. Скопіюй код у відповідний файл src/XX-name.js

# 5. Збери
node build.js

# 6. Запушти
git add .
git commit -m "feat: опис що зробив"
git push

# 7. Очисти кеш jsDelivr (відкрий в браузері)
# https://purge.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@main/dist/kulbit-main.js

# 8. Перевір на Webflow staging — Cmd+Shift+R для hard refresh
```

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

```bash
node build.js
```

## Підключення в Webflow

**Project Settings → Custom Code → Footer Code:**

```html
<script src="https://cdn.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@main/dist/kulbit-main.js"></script>
```

## Cache-busting

Після пушу зайди на:

`https://purge.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@main/dist/kulbit-main.js`

Це миттєво оновить кеш jsDelivr.
