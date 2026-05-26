# CLAUDE.md — Kulbit Webflow Project

> Цей файл — головне джерело контексту для Claude (та інших AI-асистентів) що працюють у цьому проєкті. Читай його **повністю** перед будь-якою відповіддю чи зміною коду.

---

## 1. Контекст проєкту

### Що це

Kulbit — **клієнтський сайт-лендинг** який розробляється на платформі **Webflow** з використанням кастомної JavaScript-логіки на базі **GSAP**. Сайт має **fullpage-подібну поведінку** (snap між секціями) з покроковими анімаціями всередині секцій, але **БЕЗ використання fullpage.js** — вся логіка побудована на нативних можливостях GSAP.

### Тип проєкту

- Клієнтська розробка (фіксована ціна, фіксований об'єм)
- Один продакшн-домен (буде `kulbit.com` або подібний)
- Розробка ведеться на Webflow staging (`*.webflow.io`)

### Дедлайн / стадія

Поточна стадія: **активна розробка**. Початок з нуля — порожній Webflow-шаблон, нічого не зверстано.

---

## 2. Розробник проєкту

### Профіль

- **Ім'я:** Roman (Роман)
- **Спеціалізація:** найманий Webflow-розробник (не тімлід)
- **Робота:** виключно у Webflow, кастомні скрипти, Schema.org, функціональність
- **Паралельно:** вчить fullstack-розробку
- **Не пише глибокий JS сам** — бере готові скрипти з Ambi Scripts Storage або просить допомогу
- **Використовує бібліотеки:** Swiper, GSAP, Lenis (раніше), marquee
- **Vanilla JS** для простої кастомної логіки (click → action, state, DOM)

### Робоче середовище

- **OS:** macOS виключно
- **Браузер для розробки:** Chrome (DevTools)
- **Редактор:** Cursor / VS Code
- **Git:** через CLI або вбудовану git-інтеграцію редактора
- **Мова спілкування:** **українська** (вся переписка, всі коментарі в коді)

### Обов'язкові правила комунікації

1. **Тільки українською** — і відповіді, і коментарі в коді
2. **Тільки macOS-shortcuts** — ніколи Windows / Linux
3. **Стилі коду нижче (розділ 7)** — критично дотримуватися
4. **Покроковий формат** — задачі розбиваються на маленькі кроки з тестуванням у консолі браузера на кожному кроці (детально в розділі 8)
5. **Завжди надсилати ПОВНІ скрипти** при змінах — не фрагменти
6. **НЕ робити нічого без явного запиту** — не запускати Notion-інтеграцію, не робити проактивні веб-пошуки

---

## 3. Технологічний стек

### Frontend

| Технологія     | Призначення                            | Версія                       |
| -------------- | -------------------------------------- | ---------------------------- |
| Webflow        | No-code платформа, HTML/CSS, хостинг   | актуальна                    |
| GSAP           | Анімаційна бібліотека (core)           | остання з Webflow-інтеграції |
| **Observer**   | **Ядро навігації** — wheel/touch/pointer + детекція жесту | GSAP-плагін     |
| ~~ScrollSmoother~~ | ❌ ВІДКИНУТО (див. ADR-008) — конфліктував із жорстким snap | —          |
| ScrollTrigger  | Scroll-based анімації (другорядна роль — немає вільного скролу) | GSAP-плагін |
| ScrollTo       | Програмний скрол до позицій            | GSAP-плагін                  |
| SplitText      | Розрізання тексту для анімацій         | GSAP-плагін                  |
| Flip           | Smooth layout transitions              | GSAP-плагін                  |
| DrawSVG        | Анімація SVG-обведень                  | GSAP-плагін                  |
| MorphSVG       | Морфінг SVG-shapes                     | GSAP-плагін                  |
| ScrambleText   | Ефект перетасування літер              | GSAP-плагін                  |

### Інфраструктура

| Сервіс   | Призначення                                    |
| -------- | ---------------------------------------------- |
| GitHub   | Сховище коду, версіонування                    |
| jsDelivr | CDN для роздачі зібраного коду                 |
| Webflow  | Хостинг сайту, staging, продакшн               |
| Gumroad  | (Потенційно) майбутні покупки якщо знадобиться |

### НЕ використовуємо

- ❌ **fullpage.js** — вирішено будувати snap-логіку на GSAP Observer
- ❌ **Lenis** — не використовуємо
- ❌ **ScrollSmoother** — відкинуто на Кроці 3 (див. ADR-008): на сайті немає вільного скролу, тож smooth-scroll конфліктував зі snap. Рух керується трансформом контенту.
- ❌ **jQuery** — vanilla JS + GSAP
- ❌ **TypeScript** — pure JavaScript (ES6+)
- ❌ **Webpack / Vite / bundlers** — простий Node-скрипт для конкатенації
- ❌ **NPM-залежності у браузерному коді** — все через CDN

---

## 4. Архітектура сайту

### Структура контенту

Сайт складається з:

- **8 секцій** з основним контентом (кожна 100vh)
- **Footer** на повну висоту екрану (100vh)
- **Попап-форма** (модальне вікно)
- **Header** — абсолютний (не fixed), зникає при анімаціях
- **БЕЗ якорного меню** — навігація тільки через кнопки

### Покрокова анімація — ключова фіча

Серед 8 секцій буде **більше 3 секцій з покроковою анімацією**. Принцип:

- Контент секції в межах 100vh (без `scrollOverflow`)
- Кожен скрол-жест перехоплюється Observer'ом
- На скрол → програється наступний крок GSAP timeline (durations ~0.6-0.8s)
- Поточний крок завершився → блокується наступний скрол до кінця анімації
- Тільки коли всі кроки секції пройдені → дозволяється перехід на наступну секцію
- При скролі назад — анімації reverse-яться крок за кроком

### Snap-поведінка

Будь-яка кількість/інтенсивність скролів/свайпів = **рівно один крок** (або один перехід між секціями). Поведінка ідентична класичному fullpage.js, але побудована на GSAP Observer.

### Кнопки навігації — рішення «гібрид»

Кнопки можуть вести на **конкретну секцію + конкретний крок анімації**. Логіка:

1. Плавний перехід до секції (зсув треку трансформом, `goToSection()`)
2. GSAP timeline швидко догравається до потрібного кроку
3. Далі звичайна snap-поведінка
4. Користувач завжди може скролити вгору/вниз — анімація буде у відповідному стані

Кнопки можуть розміщуватись **де завгодно** через data-атрибути:

```html
<a data-target-section="3">Секція 3</a>
<a data-target-section="5" data-target-step="2">Секція 5, етап 2</a>
```

### Респонсив-стратегія

| Девайс / орієнтація  | Поведінка                                     |
| -------------------- | --------------------------------------------- |
| Desktop (≥992px)     | Fullpage + **desktop hero-анімація** (ADR-009) |
| Tablet (768-991px)   | Fullpage + **таблет hero-анімація** (ADR-011: 3 кроки, відео→16:9) |
| **Mobile portrait (≤479px)** | Fullpage + **та сама хореографія, що й таблет** (ADR-011: `buildTabletHero`, ті самі `-tablet` атрибути) |
| **Mobile landscape (480-767px)** | **Попап «поверніть пристрій»** — hero не будуємо (Крок 8, ADR-004) |

> Брейкпоінт hero перемикається ДИНАМІЧНО через `gsap.matchMedia` (ADR-012, межі **992 / 768 / 479** — стандартні брейкпоінти Webflow): зміна ширини/орієнтації перебудовує hero **без reload**. **≤479 і 768-991 ділять одну хореографію `buildTabletHero`** (та сама анімація, ті самі `-tablet` атрибути). Стекінг секцій (ADR-010) працює на ВСІХ брейкпоінтах. Попап landscape (480-767 / по орієнтації) — `06-responsive.js` (ADR-004).

---

## 5. Глобальний стейт — `window.KulbitApp`

Єдина точка істини про стан сайту:

```javascript
window.KulbitApp = {
  // Стан
  sections: [],              // масив секцій (заповнює registerSections, див. форму нижче)
  currentSectionIndex: 0,    // індекс поточної (верхньої видимої) секції
  currentStep: 0,            // поточний крок: reveal-кроки / desktop-таймлайн (0↔1) / таблет-hero (0..3)
  isAnimating: false,        // блокування під час переходів (Observer ігнорує жести, поки true)
  videos: [],                // записи відео { player, sectionIndex, show(), hide() } — заповнює 08-video.js
  landscapeBlocked: false,   // true коли активний попап landscape (06-responsive) — відео завжди пауза

  // GSAP-інстанси та DOM
  observer: null,            // Observer instance (ядро навігації)
  mm: null,                  // gsap.matchMedia() — динамічні брейкпоінти hero (ADR-012)
  wrapper: null,             // #smooth-wrapper — фіксований вьюпорт (position:fixed; overflow:hidden)
  content: null,             // #smooth-content — контейнер секцій (СТЕКІНГ: relative; height:100vh)

  // Конфіг (усі magic numbers тут)
  config: {
    scrollDuration: 0.7,       // тривалість переходу між секціями
    stepDuration: 0.6,         // тривалість кроку анімації
    autoPlayStepDuration: 0.3, // швидке догравання при кліку на кнопку (Крок 4)
    ease: 'power2.inOut',      // easing переходів
    accelRatio: 1.4,           // поріг прискорення для детекції нового фліка (анти-інерція тачпада)
    minVelocity: 60,           // нижче цієї швидкості — «дотихання» інерції, ігноруємо
    landscapeMaxHeight: 500    // ≤ цієї висоти в landscape = телефон → попап «поверни» (ADR-004)
  },

  // Методи (02-app-core.js та 03-sections.js)
  init() { ... },             // lockViewport → registerSections → setupStacking → registerSteps → registerAnimations → setupObserver → resize
  lockViewport() { ... },     // фіксує #smooth-wrapper, вимикає вільний скрол
  registerSections() { ... }, // збирає [data-kulbit-section], проставляє data-section-index
  setupStacking() { ... },    // СТЕКІНГ (ADR-010): секції абсолютом одна над одною, z-index за індексом (рантайм)
  applyStackingPositions() { ... }, // секції 0..current — накладені (y:0), решта — під екраном (y:100%)
  registerSteps() { ... },    // reveal-кроки: збирає [data-kulbit-step] по секціях (з розмітки)
  registerAnimations() { ... }, // ДИСПЕТЧЕР через gsap.matchMedia (ADR-012): ≥992→desktop, 768-991 та ≤479→buildTabletHero, 480-767→нічого. Динамічно, без reload
  resetHeroState() { ... },  // чистий старт hero на вхід у брейкпоінт (currentSectionIndex=0, applyStackingPositions)
  teardownHero() { ... },    // вихід із брейкпоінта: GSAP ревертить контекст, обнуляємо прапорці таймлайнів
  buildDesktopAnimations() { ... }, // desktop: атрибутні таймлайни по секціях (ADR-009)
  buildSectionTimeline(els) { ... }, // паузований GSAP-таймлайн із data-kulbit-y/-scale/-scale-from/-fade/-order
  buildTabletHero() { ... },  // таблет (768-991): 3-кроковий hero (ADR-011) → hero.tabletTL, hero.isTabletHero
  tabletHeroStep(dir) { ... },// таблет: крокування hero (0↔3) + межа hero↔секція1; true якщо оброблено
  setupObserver() { ... },    // Observer + логіка жесту (анти-інерція) → кличе advance()
  advance(dir) { ... },       // делегує tabletHeroStep; інакше: reveal-крок / desktop-таймлайн / зміна секції
  goToSection(index, instant, dir) { ... }, // СТЕКІНГ: ціль наповзає знизу / поточна сповзає; + updateVideoVisibility()
  goToSectionStep(index, step) { ... },     // кнопки: секція + конкретний крок (стекінг-позиції)
  resetSteps(section, shown) { ... },        // усі reveal-кроки секції сховати/показати
  playStep(section, i) / reverseStep(section, i) { ... }, // показати/сховати reveal-крок i
  handleResize() { ... },     // перевиставляє стекінг-позиції (100vh/yPercent самі адаптуються)
  showCurrentVideo() / hideOtherVideos() / updateVideoVisibility() { ... } // 08-video.js: показати поточне ОДРАЗУ, сховати накриті на завершенні переходу (ADR-012); поважають landscapeBlocked
};

// Форма елемента app.sections[i] (заповнює registerSections + register*):
// { el, index, isFooter,
//   steps: [], isStepped,            // reveal-кроки [data-kulbit-step]
//   timeline, isAnimated,            // desktop-таймлайн (ADR-009)
//   tabletTL, isTabletHero }         // таблет-hero (ADR-011)
```

> **Механіка руху (СТЕКІНГ, ADR-010):** сторінка НЕ скролиться (`#smooth-wrapper` — `position: fixed; overflow: hidden`).
> Секції — `position: absolute; top:0; height:100vh`, накладені одна на одну (z-index за індексом). Перехід
> вниз = наступна секція наповзає знизу (`yPercent 100 → 0`) поверх поточної; вгору = поточна сповзає вниз
> (`0 → 100`). Один жест = один перехід; інерція тачпада відсікається швидкістю (`accelRatio`/`minVelocity`, ADR-008).
> Абсолют застосовує JS у рантаймі — у Webflow секції лишаються `relative` (зручно редагувати).

---

## 6. Структура папки проєкту

```
kulbit-webflow/
├── CLAUDE.md                    # Цей файл — контекст для AI
├── README.md                    # Документація для людей
├── .gitignore                   # Виключення git
├── build.js                     # Node-скрипт конкатенації
│
├── src/                         # Джерельні модулі (редагуються)
│   ├── 01-init.js               # Реєстрація GSAP-плагінів (Observer)
│   ├── 02-app-core.js           # window.KulbitApp: стан, config, lockViewport, Observer
│   ├── 03-sections.js           # Секції + кроки: реєстрація з DOM, goToSection, advance, покрокові анімації
│   ├── 04-navigation.js         # Логіка кнопок-переходів
│   ├── 05-header.js             # Зникання абсолютного хедера
│   ├── 06-responsive.js         # Респонсив + попап landscape
│   ├── 07-popup-form.js         # Логіка попап-форми
│   ├── 08-video.js              # Vimeo bg-відео (cover) + кнопка звуку ([data-kulbit-video]/[data-kulbit-sound])
│   ├── 09-button-border.js      # Ховер: промальовка бордера від точки курсора ([data-kulbit-border])
│   └── 10-project-video.js      # Vimeo-плеєр проєктів: cover + кастомні контроли ([data-kulbit-project-video], ADR-014)
│
└── dist/                        # Збірка для Webflow (генерується)
    └── kulbit-main.js           # Склеєний файл — підключається в Webflow
```

### Принципи модульності

- **Порядок виконання** гарантовано префіксами `01-`, `02-`, тощо (build.js сортує за іменем)
- **Кожен модуль** починається з коментаря-заголовка з його призначенням
- **Залежності між модулями** йдуть через `window.KulbitApp` — НЕ через import/export
- **Кожен модуль** оборотний — обгорнутий у `(function() { ... })()` IIFE або в `document.addEventListener('DOMContentLoaded', ...)` де треба

---

## 7. Стиль коду — критичні правила

### Коментарі — ВСІ українською

```javascript
// ✅ ПРАВИЛЬНО:
// ## — Ініціалізація ScrollSmoother з нормалізацією для iOS

// ❌ НЕПРАВИЛЬНО:
// Initialize ScrollSmoother with iOS normalization
```

### Структура коментарів-заголовків

**Один скрипт у файлі:**

```javascript
// ## — Опис того що робить цей скрипт
```

**Кілька скриптів в одному файлі — нумерація реальними цифрами:**

```javascript
// 01 — Ініціалізація ScrollSmoother
// 02 — Створення Observer
// 03 — Реєстрація обробників кліків
```

### Console.log — обов'язковий префікс

Кожен `console.log` має префікс що ідентифікує модуль:

```javascript
console.log('[Kulbit-Init] ScrollSmoother створено');
console.log('[Kulbit-Observer] Перехоплено wheel down');
console.log('[Kulbit-Nav] Перехід на секцію 5, крок 2');
```

**Не видаляти console.log без явного підтвердження від Romana.**

### Іменування

```javascript
// Змінні та функції — camelCase
const currentStep = 0;
function goToSection(index) {}

// Глобальні обʼєкти — PascalCase з префіксом Kulbit
window.KulbitApp = {};

// CSS-класи у HTML/Webflow — kebab-case
// .section-stepped, .header-wrapper

// data-атрибути — kebab-case
// data-target-section, data-step-index
```

### НЕ використовувати

- ❌ `var` — тільки `const` / `let`
- ❌ `function name() {}` для callbacks — використовувати arrow functions
- ❌ Анонімні magic numbers — виносити в `KulbitApp.config`
- ❌ Inline-стилі в JS якщо можна додати клас і керувати через CSS

### Особливість Webflow-середовища

- **НЕ** використовувати `Webflow.push` (це для fullpage-стилю, але ми його не використовуємо)
- **НЕ** додавати `<script>` теги в коді (підключення тільки через Webflow Footer Code)
- **Використовувати** `DOMContentLoaded` для гарантії що DOM готовий

---

## 8. Workflow роботи з Romanом

### Покроковий формат — обов'язковий

Будь-яка задача розбивається на маленькі кроки:

1. **Claude пояснює** який крок зараз робимо і чому
2. **Claude дає код** для тестування в консолі браузера з детальними `console.log`
3. **Roman запускає** код в DevTools Console на staging
4. **Roman шерить результат** (скриншот консолі або словами)
5. **Тільки після підтвердження** — переходимо до наступного кроку
6. **В кінці** — фінальне зібрання у файл модуля + пуш на GitHub

### Що **ніколи** не робити

- ❌ Давати код одним великим блоком без розбивки на кроки
- ❌ Стрибати на наступний крок без підтвердження попереднього
- ❌ Видаляти `console.log` без явного запиту Romana
- ❌ Робити веб-пошук без явного запиту
- ❌ Використовувати Notion-інтеграцію без запиту
- ❌ Робити фіктивні припущення про контекст — краще запитати

### Консольні тести → файл `console.js` (рішення сесії 21.05.2026)

- Код для вставки в консоль браузера пиши **у файл `console.js`** (корінь проєкту), а НЕ в чат.
- Там лежить **лише АКТУАЛЬНИЙ тест**: новий код перезаписує старий (Roman відкриває файл, виділяє все, копіює).
- `console.js` — у `.gitignore` (скретч-файл, не входить у бандл; build.js читає тільки `src/`).
- Логи в консольних тестах — **ASCII-safe**: уникай `→`, дужок/лапок усередині рядкових літералів (`'(dir'`, `')'`) та апострофів у коментарях — Chrome при копіюванні з рендеру іноді псує ці символи (`Unexpected token`). Використовуй `->`, `'to'` тощо.

### При змінах існуючого коду

- **Завжди шериш повний оновлений файл**, не фрагмент
- Поясни що змінилось і чому
- Якщо зміни в кількох файлах — кожен файл окремо, цілком

---

## 9. Workflow з GitHub + jsDelivr

### Локальна розробка

```bash
# 1. Редагуєш файли у src/ через Cursor/VS Code
# 2. Запускаєш збірку:
node build.js

# 3. Перевіряєш dist/kulbit-main.js — має бути склеєне
# 4. Комітиш і пушиш:
git add .
git commit -m "feat: опис зміни"
git push
```

### Cache-bust для jsDelivr

jsDelivr кешує файли до 12 годин. Для оновлення після пушу:

**Варіант 1 — Purge URL** (рекомендую під час розробки):

```
https://purge.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@main/dist/kulbit-main.js
```

Відкрити в браузері після пушу — кеш миттєво оновлюється.

**Варіант 2 — версійний параметр у Webflow:**

```html
<script src="https://cdn.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@main/dist/kulbit-main.js?v=20260520-1"></script>
```

Збільшувати `?v=` параметр при кожному оновленні.

**Варіант 3 — commit-pinned URL (НАЙНАДІЙНІШИЙ для негайного тесту):** ⚠️ на практиці `@main` на jsDelivr **сильно лагає** навіть після purge (edge-ноди тримають старий бандл). Commit-pinned URL immutable і завжди свіжий:

```html
<script src="https://cdn.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@<commit-hash>/dist/kulbit-main.js"></script>
```

Підставляєш короткий хеш свіжого коміту (напр. `@a0d1a7c`), тестуєш одразу, потім повертаєш `@main` коли кеш розсмокчеться. **Актуальний бандл — на `a0d1a7c`** — для commit-pinned тесту коду підставляй саме `@a0d1a7c`. _Стабільна база: hero + is-our-clients (усі девайси) + is-projects свап (desktop + tablet/mobile) + контролі відео на tablet/mobile (fullscreen через Vimeo SDK, mute-кнопка, desktop scroll-lock у fullscreen) + персистентність позиції секції (sessionStorage, reload не скидає на hero). Усе підтверджено Romanom. Решта ADR-016 (auto-landscape fullscreen, «одне відео») — попереду; історія re-approach у git `50fb693`..`1500d68`._

> ⚠️ **Урок (регресія скролу 26.05.2026 — для майбутнього re-approach):** у `buildProjects` `section` = запис `app.sections` `{el, index, …}`, а НЕ DOM-елемент. `getComputedStyle(section)` кинув помилку → `registerAnimations` (matchMedia) впав ДО `setupObserver` → зник скрол на всьому сайті. Уроки: (1) у `buildProjects`/`build*` для DOM-операцій брати `section.el`, не `section`; (2) варто залишити захист — `init` обгортає `registerAnimations` у try/catch, щоб помилка білду не вбивала Observer (було в `c7b8470`, відкочено разом з рештою — повернути при re-approach).

### Підключення в Webflow

**Project Settings → Custom Code → Footer Code:**

```html
<!-- Kulbit — кастомні скрипти -->
<script src="https://cdn.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@main/dist/kulbit-main.js"></script>
```

### Конвенція git-комітів

```
feat: додав логіку Observer
fix: виправив respond на mobile landscape
refactor: винесений config в окремий обʼєкт
docs: оновив README
chore: оновив build.js
```

---

## 10. Прийняті архітектурні рішення (ADR)

> **Повні ADR з деталями механіки — у [`docs/adr.md`](docs/adr.md).** Тут лише індекс рішень; за деталями конкретного ADR читай той файл.

- **ADR-001** — Відмова від fullpage.js: snap будуємо на GSAP Observer (гнучкість для >3 покрокових секцій, без ліцензій).
- **ADR-002** — ⚠️ СКАСОВАНО (див. ADR-008): ScrollSmoother замість Lenis — відкинуто, конфліктував зі snap.
- **ADR-003** — Гібридні кнопки-переходи: секція + крок з авто-програванням таймлайну (`04-navigation.js`, `data-target-section`/`-step`).
- **ADR-004** — Mobile landscape → попап «поверни пристрій» (`06-responsive.js`); детект по орієнтації + `max-height ≤ 500` + `pointer: coarse`; розмітка `[data-kulbit-landscape-popup]`.
- **ADR-005** — Зберігання коду: GitHub-репо + jsDelivr CDN (push → purge / commit-pinned URL).
- **ADR-006** — Модульна `src/*` з префіксами `01-`..`10-` + Node `build.js` конкатенація в один dist-файл.
- **ADR-007** — Декаплінг JS-гачка від стилю через data-атрибут (`data-kulbit-section`/`-header`); стильові класи лишаються вільними.
- **ADR-008** — Жорсткий fullpage на Observer + transform (БЕЗ ScrollSmoother). Вьюпорт `position:fixed; overflow:hidden`. Анти-інерція тачпада за швидкістю (`accelRatio`/`minVelocity`). Напрям скролу — за ТИПОМ події (`wheel` натурально / `touch` інверсно); тип вводу `'wheel,touch'` (без `pointer`).
- **ADR-009** — Data-driven таймлайни: кроки описуються атрибутами `data-kulbit-y/-scale/-scale-from/-fade/-order`, JS (`buildSectionTimeline`) збирає GSAP-таймлайн. Тільки desktop (≥992). Vimeo bg-відео — завжди `<iframe>` в Embed (`08-video.js`).
- **ADR-010** — Стекінг секцій (накладання absolute + z-index, рантайм) замість лінійного треку; `yPercent` resize-proof. `setupStacking`/`applyStackingPositions`.
- **ADR-011** — Брейкпоінт-залежний таблет/мобайл-hero (`buildTabletHero`, 3 кроки; tablet 768-991 і mobile ≤479 ділять `-tablet` атрибути) + пауза/мут відео по видимості.
- **ADR-012** — Динамічні брейкпоінти через `gsap.matchMedia` (992/768/479) — hero перебудовується без reload (`resetHeroState`/`teardownHero`); таймінг паузи відео — на завершенні накриття.
- **ADR-013** — Покрокова хореографія `is-our-clients` (`section.oc` + ScrambleText): свап наборів карток + прогрес-бар + скрамбл заголовків за видимістю у вьюпорті (IntersectionObserver). Усі 3 брейкпоінти ✅ ПІДТВЕРДЖЕНО (`shiftN` per-mode).
- **ADR-014** — Кастомний Vimeo-плеєр проєктів (`10-project-video.js`): cover + власні контроли (play/pause, seek+буфер, гучність-попап, fullscreen); `[data-kulbit-project-video]`; `pointer-events:none` на iframe (щоб колесо доходило до Observer). ✅
- **ADR-015** — Свап-секція `is-projects` (`section.pv`): вертикальний свап відео (`height 100↔0`) + END-картинка + прогрес-бар + фікс прогрес-лінії. ✅
- **ADR-016** — 🔄 **ЧАСТКОВО ПОВЕРНЕНО 26.05.2026**: початковий батч (свап+персистентність+landscape) відкочено (`3978c4d`) через багато проблем. Тепер по одній: **п.1 tablet/mobile свап вікном 3 — ✅ У КОДІ** (`a34408b`+`86b1c33`, desktop+mobile підтверджено; `buildProjects` через `WIN`, `flex:none`+`height`, slotH від секції). Решта (персистентність/«одне відео»/landscape-fullscreen) + iOS-обмеження плеєра (fullscreen на div, гучність) — ще ні. Деталі — `docs/adr.md` ADR-016; код re-approach — git `50fb693`..`1500d68`.

---

## 11. План виконання — поточний статус

> Детальна історія сесій — у git-логу та `docs/adr.md`. Тут — чек-лист + поточний стан.

### Виконано

- [x] Архітектура, стек, усі ADR, інфраструктура (GitHub + jsDelivr)
- [x] **Крок 0-1:** репо + `src/`-скелети + jsDelivr + підключення в Webflow Footer; ScrollSmoother init (згодом скасовано — ADR-008)
- [x] **Крок 2:** 9 снап-зупинок у Webflow (8 секцій + footer, кожна 100vh), `data-kulbit-section` / `data-kulbit-header` — перевірено
- [x] **Крок 3:** snap-навігація на Observer + transform (ADR-008) — анти-інерція, миша+тачпад
- [x] **Крок 4:** кнопки-переходи (`04-navigation.js`, `data-target-section` число/імʼя)
- [x] **Крок 5:** механізм покрокових анімацій (reveal-кроки + `goToSectionStep`)
- [x] **Крок 7:** header зникає в межах hero-таймлайну (окремої логіки не треба)
- [x] **Крок 8:** респонсив + landscape-попап + динамічний `matchMedia` (ADR-012)
- [x] **HERO — повністю готова** на всіх брейкпоінтах (desktop ADR-009 / tablet+mobile ADR-011) + Vimeo bg-відео + стекінг
- [x] **is-our-clients — повністю готова** на всіх 3 брейкпоінтах (ADR-013)
- [x] **is-projects** готова: плеєр (ADR-014) + свап + прогрес (ADR-015) на DESKTOP + **свап вікном 3 на tablet/mobile** (ADR-016 п.1) ✅
- [x] Додатково: ховер-бордер кнопок (`09-button-border.js`), Vimeo bg-відео (`08-video.js`)

### Наступні кроки

- [~] **Крок 6:** анімації решти 7 секцій + footer — рушій готовий (ADR-009 атрибути або reveal-кроки `[data-kulbit-step]`), чекає верстки Romana
- [x] **is-projects tablet/mobile свап вікном 3** — ✅ (ADR-016 п.1, `a34408b`+`86b1c33`)
- [x] **Елементи керування відео на tablet/mobile** — ✅ fullscreen через Vimeo SDK (нативний iOS), кнопка звуку = mute-toggle, перший клік play стартує (звук — окремою кнопкою, бо iOS не дає unmute у кліку старту), desktop fullscreen блокує навігацію-скрол (`64225c8`..`f032eab`)
- [x] **Персистентність позиції секції** — ✅ sessionStorage, reload/перебудова не скидають на hero (ADR-016 п.5, `8e932f8`+`a0d1a7c`)
- [ ] **Поворот+fullscreen UX** (крок D/B/C): у fullscreen поворот паузить відео (B); авто-landscape при fullscreen (C); поворот+вихід з fullscreen скидає на hero з кривими анімаціями (D)
- [ ] **is-projects:** решта ADR-016 — «грає одне відео»
- [ ] **Крок 9:** попап-форма (`07-popup-form.js`)
- [ ] **Крок 10:** фінальний поліш; **Крок 11:** клієнтське демо; **Крок 12:** продакшн-домен

### 🔖 Точка відновлення (26.05.2026 — стабільна база)

**Поточний стабільний стан = `a0d1a7c`.** Hero + is-our-clients (всі девайси) + is-projects (DESKTOP плеєр+свап+прогрес + **tablet/mobile свап вікном 3**) + скрол над відео + **контролі відео на tablet/mobile** (fullscreen через Vimeo SDK, mute-кнопка, desktop scroll-lock у fullscreen) + **персистентність позиції** (sessionStorage) — **усе підтверджене Romanом** (desktop + реальний iPhone Safari). Бандл ~98 KB.

**Як сюди дійшли:** початковий батч ADR-016 (свап+персистентність+landscape разом) внесли багато проблем + регресію скролу → відкат до `f0928a9` (`3978c4d`). Потім **по одній фічі з тестом**: повернули лише свап вікном 3 (`a34408b` + фікс slotH `86b1c33`). **Урок (memory [[incremental-not-batched]]):** фічі по ОДНІЙ. Ще урок (memory [[mobile-zoom-before-css-debug]]): мобільний візуальний зсув на одному девайсі — спершу перевір `visualViewport.scale` (застряглий zoom), потім CSS.

**Стан верстки:** 9 зупинок розмічені; hero + is-our-clients + is-projects готові. Решта секцій + footer — Roman верстає. Атрибути hero та Vimeo-embed — у `docs/hero-reference.md`. ⚠️ дефект верстки на майбутнє: `.hero-video-mask`/`.hero-video-wrapper` мають `overflow:visible` — варто `hidden` (cover-iframe інакше може розпирати документ на iOS).

**Далі (поворот+fullscreen UX):** B — у fullscreen поворот паузить відео (наша pause-by-visibility реагує на orientationchange); C — авто-landscape при fullscreen (`orientation.lock`); D — поворот+вихід із fullscreen скидає на hero з кривими анімаціями. Потім «грає одне відео». Експериментальний код re-approach — git `50fb693`..`1500d68`.

**Урок про iOS+Vimeo звук (memory [[ios-vimeo-unmute]]):** розмутити Vimeo на iOS можна лише на відео, що ВЖЕ грає, синхронно в gesture (як hero `background=1`). Відео, що стартує з кліку, в тому ж кліку розмутити не можна — звук лише окремою кнопкою.

**Не забути:** після пушу — purge jsDelivr (для тесту — commit-pinned `@<hash>`, бо `@main` лагає до 12 год). Webflow: секції лишай `relative` + `top:0` + `height:100vh` + `overflow:hidden` (JS перебиває на absolute на проді).

---

## 12. Ризики та невирішені питання

### Відкриті питання

- **Продакшн-домен:** ще не визначений (буде `kulbit.com` чи інший?)
- **Контент покрокових секцій:** які саме анімації потрібні в кожній — буде уточнятись з клієнтом
- **Дизайн:** поки не зверстаний у Webflow, секції будуть додаватись на ходу
- **Конкретна логіка кнопок-переходів:** скільки буде, куди вестимуть — поки лише 2 в плані

### Технічні ризики

- **Observer + transform fullpage на iOS Safari** — `preventDefault` на touch + `100vh`/`offsetTop` поведінка на мобілці (адресний бар) потребують тестування на реальних девайсах (Крок 8). `accelRatio`/`minVelocity` можливо доведеться калібрувати під тач.
- **ScrollSmoother прибрано (ADR-008)** — якщо колись знадобиться parallax по скролу, доведеться переглядати всю модель навігації
- **Webflow CMS** — якщо в проєкті з'являться CMS-колекції з динамічними секціями, треба буде переробляти реєстрацію секцій
- **Кеш jsDelivr** — при швидких ітераціях розробки покривається через purge, але треба пам'ятати про це

---

## 13. Контакти та посилання

- **GitHub репо:** `https://github.com/Roman-Shostak/kulbit-webflow`
- **jsDelivr URL:** `https://cdn.jsdelivr.net/gh/Roman-Shostak/kulbit-webflow@main/dist/kulbit-main.js` (для тесту — commit-pinned `@<hash>`, §9)
- **Webflow staging:** `https://kulbit-gsap.webflow.io`
- **Webflow продакшн:** `https://???` _(буде вказано після запуску)_
- **Локальний експорт `kulbit-gsap.webflow/`** (у репо, в `.gitignore`) — **застарілий** (до додавання атрибутів). Для актуальної верстки: staging або **Webflow MCP** (спершу `webflow_guide_tool`).
- **`console.js`** (корінь, у `.gitignore`) — скретч для консольних тестів (§8).

---

## 14. Як Claude має реагувати

### При першому контакті в новому чаті / IDE-сесії

1. Прочитати цей файл повністю
2. Запитати Romana на якому кроці ми зараз (див. розділ 11)
3. Дотримуватись усіх правил з розділів 2, 7, 8

### При зміні архітектурного рішення

1. Запропонувати оновити цей файл (додати новий ADR у розділ 10)
2. **НЕ робити мовчазно** — Roman має знати про зміну архітектури

### При знаходженні бага в існуючому коді

1. Сказати в якому файлі/модулі
2. Запропонувати фікс з повним оновленим файлом
3. Пояснити що саме змінилось і чому

### При непевності

1. **Запитати Romana**, не вгадувати
2. **НЕ робити веб-пошук** автоматично — тільки якщо Roman явно попросив

---

## 15. Довідник: розмітка hero + Vimeo

> **Винесено в [`docs/hero-reference.md`](docs/hero-reference.md)** — DOM hero (секція 0), ключові CSS-факти Webflow, Vimeo-embed (ID `1180786664`, hash `865b5a46af`) та повна мапа data-атрибутів hero (desktop + `-tablet`). Читай за потреби (робота з hero/відео).

---

_Останнє оновлення: 26 травня 2026 — CLAUDE.md стиснено (78.5k → ~28k символів): повні ADR → `docs/adr.md`, довідник hero → `docs/hero-reference.md`, §11 ущільнено. Зміст не втрачено (усе в `docs/` + git). Поточний стан коду = стабільна `f0928a9`; точка відновлення — кінець §11._
_При значущих змінах: новий/змінений ADR → `docs/adr.md` (+ рядок в індекс §10); план → §11._
