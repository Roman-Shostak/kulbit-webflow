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

- GSAP + **Observer** (жорсткий fullpage без вільного скролу, замість fullpage.js та ScrollSmoother — див. ADR-008 у CLAUDE.md)
- Рух — трансформом контенту (`#smooth-content`), вьюпорт фіксований (`#smooth-wrapper`)
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

---

## Тест-сніппети (DevTools Console)

> Лише для розробки. Вставляти в консоль на **staging** після завантаження бандла.
> Усі вони тимчасові — зникають після перезавантаження сторінки.

### 1. Перевірка розмітки секцій

Скільки снап-зупинок, їх висоти, footer, header:

```javascript
(() => {
  const stops = document.querySelectorAll('[data-kulbit-section]');
  console.log('[Check] зупинок:', stops.length, '(очікуємо 9)');
  stops.forEach((el, i) => {
    const h = Math.round(el.getBoundingClientRect().height);
    console.log(`[Check] #${i} "${el.className}" — ${h}px`);
  });
  const header = document.querySelector('[data-kulbit-header]');
  console.log('[Check] header:', !!header, header ? header.className : '');
})();
```

### 2. Фарбування секцій + номери

Робить snap видимим на порожній верстці (кожна секція — свій колір + номер):

```javascript
window.KulbitApp.sections.forEach((s) => {
  s.el.style.backgroundColor = `hsl(${s.index * 40}, 65%, 55%)`;
  s.el.style.position = 'relative';
  let b = s.el.querySelector('.dbg');
  if (!b) {
    b = document.createElement('div');
    b.className = 'dbg';
    Object.assign(b.style, {
      position: 'absolute', top: '16px', left: '16px', zIndex: '9999',
      font: '700 56px/1 sans-serif', color: '#fff',
      textShadow: '0 2px 8px rgba(0,0,0,.45)', pointerEvents: 'none'
    });
    s.el.appendChild(b);
  }
  b.textContent = s.isFooter ? `${s.index} · footer` : s.index;
});
```

### 3. Тест-кнопки переходів

Тимчасова панель кнопок (обробник `data-target-section` уже в бандлі). Секцію 4 для демо називаємо `pricing`:

```javascript
(() => {
  const app = window.KulbitApp;
  if (app.sections[4]) app.sections[4].el.setAttribute('data-section-name', 'pricing');
  const old = document.querySelector('#kulbit-test-nav');
  if (old) old.remove();
  const panel = document.createElement('div');
  panel.id = 'kulbit-test-nav';
  Object.assign(panel.style, {
    position: 'fixed', right: '16px', bottom: '16px', zIndex: '99999',
    display: 'flex', flexDirection: 'column', gap: '8px'
  });
  [['→ секція 3', '3'], ['→ footer', '8'], ['→ pricing', 'pricing'], ['→ нагору', '0']].forEach(([label, target]) => {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = label;
    a.setAttribute('data-target-section', target);
    Object.assign(a.style, {
      padding: '10px 14px', background: '#111', color: '#fff',
      font: '600 14px sans-serif', borderRadius: '8px', textDecoration: 'none'
    });
    panel.appendChild(a);
  });
  document.body.appendChild(panel);
})();
```

### 4. Калібрування анти-інерції (тачпад)

`config` читається наживо, тож пороги можна крутити прямо в консолі й одразу тестувати скрол:

```javascript
KulbitApp.config.accelRatio = 1.2;  // менше = чутливіше до нових фліків (пропускає менше)
KulbitApp.config.minVelocity = 40;  // нижче = реагує на слабші рухи
KulbitApp.config.scrollDuration = 0.7; // тривалість переходу між секціями
```

### 5. Швидкий перехід на секцію

```javascript
KulbitApp.goToSection(5);        // плавно на секцію 5
KulbitApp.goToSection(0, true);  // миттєво (без анімації) нагору
```

### 6. Плейсхолдер-кроки (тест покрокової секції без верстки)

Впихає N кроків `[data-kulbit-step]` у задану секцію і перереєстровує. Далі скроль у цю секцію — кроки проявлятимуться по одному:

```javascript
(() => {
  const app = window.KulbitApp;
  const idx = 2, n = 3; // секція 2, 3 кроки
  const sec = app.sections[idx].el;
  sec.style.position = 'relative';
  sec.querySelectorAll('.dbg-step').forEach((el) => el.remove());
  for (let i = 1; i <= n; i++) {
    const step = document.createElement('div');
    step.className = 'dbg-step';
    step.setAttribute('data-kulbit-step', '');
    step.textContent = `Крок ${i}`;
    Object.assign(step.style, {
      position: 'absolute', left: '80px', top: `${15 + i * 20}%`,
      font: '700 40px sans-serif', color: '#fff', zIndex: '5',
      background: 'rgba(0,0,0,.65)', padding: '12px 22px', borderRadius: '10px'
    });
    sec.appendChild(step);
  }
  app.registerSteps();
  console.log('[DBG] плейсхолдер-кроки додано в секцію', idx, '— скроль туди');
})();
```

> 💡 Якщо при вставці зʼявляється `Invalid or unexpected token` — це довгий рядок зламався при копіюванні. Скопіюй сніппет ще раз цілком.
