/* Kulbit Webflow — зібрано 2026-05-22T11:05:10.305Z */

// ====================================================================
// 01-init.js — Реєстрація GSAP-плагінів
// Kulbit — кастомний сайт на Webflow + GSAP
// Архітектура: жорсткий fullpage БЕЗ вільного скролу, на Observer + transform
//              (без ScrollSmoother — див. ADR-008)
// ====================================================================

console.log('[Kulbit] 01-init.js завантажено');

// ## — Реєстрація плагінів (огорнуто в IIFE, щоб не засмічувати глобал)
(() => {
  // 01 — Перевірка наявності GSAP та Observer — без них логіка не працює
  if (typeof gsap === 'undefined' || typeof Observer === 'undefined') {
    console.error('[Kulbit-Init] ❌ GSAP або Observer не завантажені — перевір підключення плагінів у Webflow');
    return;
  }

  // 02 — Observer — ядро навігації (перехоплення wheel/touch/pointer)
  gsap.registerPlugin(Observer);

  // 03 — ScrollTrigger — лишаємо зареєстрованим про запас (якщо підключений)
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // 04 — ScrambleText — для скрамбл-ефекту текстів (секція is-our-clients)
  if (typeof ScrambleTextPlugin !== 'undefined') {
    gsap.registerPlugin(ScrambleTextPlugin);
  }

  console.log('[Kulbit-Init] ✅ Плагіни зареєстровано (Observer)');
})();


// ====================================================================
// 02-app-core.js — Ядро застосунку: стан, config, фіксація вьюпорта,
//                   Observer + логіка жесту (анти-інерція)
// ====================================================================

console.log('[Kulbit] 02-app-core.js завантажено');

// ## — Створення глобального обʼєкта KulbitApp + ініціалізація
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // 01 — Стан (єдина точка істини про сайт)
  app.sections = app.sections || []; // масив зареєстрованих секцій (заповнює 03-sections.js)
  app.currentSectionIndex = 0;       // індекс поточної секції
  app.currentStep = 0;               // поточний крок у покроковій секції (Крок 5)
  app.isAnimating = false;           // блокування під час переходів
  app.observer = null;               // інстанс Observer
  app.wrapper = null;                // #smooth-wrapper — фіксований вьюпорт
  app.content = null;                // #smooth-content — рухомий трек із секціями

  // 02 — Конфіг (усі числа тут, без magic numbers по коду)
  app.config = {
    scrollDuration: 0.7,       // тривалість переходу між секціями
    stepDuration: 0.6,         // тривалість кроку покрокової анімації (Крок 5)
    autoPlayStepDuration: 0.3, // швидке догравання при кліку на кнопку (Крок 4)
    ease: 'power2.inOut',      // easing переходів
    accelRatio: 1.4,           // у скільки разів має зрости швидкість, щоб вважати НОВИМ фліком
    minVelocity: 60,           // нижче цієї швидкості — «дотихання» інерції, ігноруємо
    landscapeMaxHeight: 500    // ≤ цієї висоти в landscape = телефон → попап «поверни» (ADR-004)
  };

  // 03 — Фіксація вьюпорта: вільний скрол стає фізично неможливим
  app.lockViewport = () => {
    app.wrapper = document.querySelector('#smooth-wrapper');
    app.content = document.querySelector('#smooth-content');
    if (!app.wrapper || !app.content) {
      console.error('[Kulbit-Core] ❌ Немає #smooth-wrapper / #smooth-content — перевір розмітку');
      return false;
    }
    Object.assign(app.wrapper.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      overflow: 'hidden'
    });
    gsap.set(app.content, { y: 0 });
    window.scrollTo(0, 0);
    console.log('[Kulbit-Core] вьюпорт зафіксовано (вільний скрол вимкнено)');
    return true;
  };

  // 04 — Логіка жесту: відрізняємо НОВИЙ флік від хвоста інерції за швидкістю.
  //      Хвіст інерції сповільнюється → ігноруємо; новий флік дає сплеск швидкості → приймаємо.
  let flinging = false; // чи триває інерція попереднього жесту
  let prevVel = 0;      // швидкість попередньої події (для детекції прискорення)

  const handleGesture = (dir, self) => {
    const vel = Math.abs(self.velocityY);
    const accelerating = vel > prevVel * app.config.accelRatio && vel > app.config.minVelocity;
    prevVel = vel;

    if (app.isAnimating) return;           // йде перехід/крок — чекаємо завершення
    if (flinging && !accelerating) return; // це хвіст інерції — ігноруємо

    flinging = true;
    app.advance(dir); // advance вирішує: крок чи секція (визначено у 03-sections.js)
  };

  // 05 — Створення Observer (один жест = один перехід)
  app.setupObserver = () => {
    if (app.observer) app.observer.kill();
    // Напрямок визначаємо за ТИПОМ ПОДІЇ, а НЕ за девайсом (надійніше: деякі десктопи хибно
    // звітують pointer:coarse → тач-інверсія ламала колесо). Колесо — натурально (вниз = далі);
    // тач-свайп — інверсно (свайп угору = далі, як нативний скрол). 'pointer' НЕ слухаємо —
    // щоб затиснута ЛКМ + рух мишею не сприймались як скрол (на будь-якому девайсі).
    const gestureDir = (down, self) => {
      const isWheel = self.event && self.event.type === 'wheel';
      return isWheel ? (down ? 1 : -1) : (down ? -1 : 1);
    };
    app.observer = Observer.create({
      target: window,
      type: 'wheel,touch',
      tolerance: 10,
      preventDefault: true, // блокуємо нативний скрол — рухаємось ТІЛЬКИ по секціях
      onDown: (self) => handleGesture(gestureDir(true, self), self),
      onUp: (self) => handleGesture(gestureDir(false, self), self),
      onStop: () => { flinging = false; prevVel = 0; } // приймаємо новий ввід лише коли все стихло
    });
    console.log('[Kulbit-Core] Observer створено (snap активний), type: wheel,touch; напрямок за подією');
  };

  // 06 — Ресайз. У стекінгу (ADR-010) висота 100vh і yPercent самі підлаштовуються під
  //      новий розмір; для певності перевиставляємо дискретні позиції, якщо не йде анімація.
  let resizeTimer = null;
  app.handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!app.isAnimating && app.applyStackingPositions) {
        app.applyStackingPositions();
        console.log('[Kulbit-Core] ресайз — позиції стекінгу оновлено');
      }
    }, 150);
  };

  // 07 — Ініціалізація після готовності DOM
  app.init = () => {
    // Захист: якщо десь лишився живий ScrollSmoother — прибираємо (він тягне вільний скрол)
    if (typeof ScrollSmoother !== 'undefined' && ScrollSmoother.get()) {
      ScrollSmoother.get().kill();
      console.log('[Kulbit-Core] знайдено старий ScrollSmoother — прибрано');
    }

    if (!app.lockViewport()) return;
    app.registerSections();   // визначено у 03-sections.js
    app.setupStacking();      // стекінг-лейаут: секції абсолютом одна над одною (ADR-010)
    app.registerSteps();      // reveal-кроки [data-kulbit-step]
    app.registerAnimations(); // кастомні таймлайни секцій (ADR-009; тільки desktop)
    app.setupObserver();
    window.addEventListener('resize', app.handleResize);
    console.log('[Kulbit-Core] ✅ KulbitApp ініціалізовано');
  };

  document.addEventListener('DOMContentLoaded', () => app.init());
})();


// ====================================================================
// 03-sections.js — Секції + кроки: реєстрація з DOM, СТЕКІНГ-переходи, покрокові анімації
//                  (методи додаються до KulbitApp з 02-app-core.js)
//
//   Навігація — СТЕКІНГ (ADR-010): секції накладаються одна на одну.
//   Два типи покрокових секцій (детектяться з розмітки):
//   • reveal-кроки  — елементи [data-kulbit-step] (дефолтний показ autoAlpha+y)
//   • кастомний таймлайн — елементи з [data-kulbit-y] / [data-kulbit-scale] /
//     [data-kulbit-fade] складаються в один GSAP-таймлайн (ADR-009).
// ====================================================================

console.log('[Kulbit] 03-sections.js завантажено');

// ## — Методи роботи з секціями, стекінгом, кроками та кастомними таймлайнами
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // Селектор анімованих елементів кастомного таймлайну
  const ANIM_SELECTOR = '[data-kulbit-y],[data-kulbit-scale],[data-kulbit-fade]';
  const num = (el, attr, fallback) => {
    const v = parseFloat(el.getAttribute(attr));
    return Number.isNaN(v) ? fallback : v;
  };

  // 01 — Реєстрація секцій з DOM. Індекс проставляє JS з DOM-порядку (reorder-safe).
  app.registerSections = () => {
    const els = document.querySelectorAll('[data-kulbit-section]');
    app.sections = Array.from(els).map((el, index) => {
      el.setAttribute('data-section-index', index);
      return {
        el, index,
        isFooter: el.classList.contains('footer'),
        steps: [], isStepped: false,        // reveal-кроки
        timeline: null, isAnimated: false,  // кастомний таймлайн desktop (ADR-009)
        tabletTL: null, isTabletHero: false, // спец таблет-hero (ADR-011)
        oc: null, isOurClients: false        // спец секція is-our-clients (ADR-013)
      };
    });

    if (!app.sections.length) {
      console.error('[Kulbit-Sections] ❌ Не знайдено секцій [data-kulbit-section]');
      return;
    }
    console.log('[Kulbit-Sections] зареєстровано секцій:', app.sections.length);
  };

  // 02 — Реєстрація reveal-кроків: для кожної секції збираємо [data-kulbit-step] у DOM-порядку.
  //      Покроковість детектиться З РОЗМІТКИ, не зі списку в JS.
  app.registerSteps = () => {
    app.sections.forEach((s) => {
      const stepEls = s.el.querySelectorAll('[data-kulbit-step]');
      stepEls.forEach((el, i) => el.setAttribute('data-step-index', i));
      s.steps = Array.from(stepEls);
      s.isStepped = s.steps.length > 0;
      if (s.isStepped) {
        app.resetSteps(s, false); // на старті всі кроки сховані
        console.log(`[Kulbit-Steps] секція ${s.index}: reveal-кроки, кроків: ${s.steps.length}`);
      }
    });
  };

  // 03 — Реєстрація анімацій hero за брейкпоінтом — ДИНАМІЧНО через gsap.matchMedia (ADR-011/012).
  //      Зміна ширини/орієнтації перебудовує hero БЕЗ reload: на вхід у брейкпоінт — будуємо,
  //      на вихід — GSAP сам ревертить таймлайни/сети контексту, ми чистимо стан (teardownHero).
  //      Desktop (≥992): атрибутні таймлайни (ADR-009).
  //      Tablet (768-991) ТА Mobile (≤479): та сама спец hero-хореографія (buildTabletHero),
  //        читає ті самі -tablet атрибути; геометрія (16:9/кнопка/накриття) рахується динамічно.
  //      480-767 («Mobile landscape» у Webflow): діапазон попапа «поверни екран» — hero не будуємо.
  //      На кожній зміні брейкпоінта повертаємось на hero (resetHeroState) — стан стартує чистим.
  app.registerAnimations = () => {
    if (app.mm) app.mm.kill();         // якщо колись перевикликають — прибрати старий matchMedia
    app.mm = gsap.matchMedia();

    const buildTablet = () => {        // спільна гілка для tablet і mobile (однакова хореографія)
      app.resetHeroState();
      app.buildTabletHero();
      return () => app.teardownHero();
    };

    app.mm.add('(min-width: 992px)', () => {              // desktop ≥992
      app.resetHeroState();
      app.buildDesktopAnimations();
      app.buildOurClients();                             // секція is-our-clients (ADR-013, поки лише десктоп)
      return () => app.teardownHero();
    });
    app.mm.add('(min-width: 768px) and (max-width: 991px)', buildTablet); // tablet 768-991
    app.mm.add('(max-width: 479px)', buildTablet);                        // mobile-портрет ≤479
    // 480-767 — горизонтальна мобілка: hero не будуємо (попап landscape, 06-responsive.js)

    console.log('[Kulbit-Anim] matchMedia активний (брейкпоінти 992/768/479, динамічна перебудова)');
  };

  // 03-0 — Чистий стан перед побудовою hero (старт кожного брейкпоінта з hero, крок 0).
  app.resetHeroState = () => {
    app.currentSectionIndex = 0;
    app.currentStep = 0;
    app.isAnimating = false;
    app.applyStackingPositions();                 // дискретні позиції стекінгу під currentSectionIndex=0
    if (app.updateVideoVisibility) app.updateVideoVisibility();
  };

  // 03-0b — Прибирання hero при виході з брейкпоінта. GSAP САМ ревертить таймлайни/сети контексту;
  //         нам лишається скинути наші посилання/прапорці (новий контекст усе перебудує).
  app.teardownHero = () => {
    app.sections.forEach((s) => {
      s.timeline = null; s.isAnimated = false;
      s.tabletTL = null; s.isTabletHero = false;
      s.oc = null; s.isOurClients = false;
    });
    console.log('[Kulbit-Anim] teardown hero (зміна брейкпоінта)');
  };

  // 03a — Desktop: атрибутні таймлайни по секціях (ADR-009).
  //       Елементи прив'язуємо до секції через closest; ті, що поза секціями (header) → hero.
  app.buildDesktopAnimations = () => {
    const animEls = document.querySelectorAll(ANIM_SELECTOR);
    if (!animEls.length) return;

    const bySection = new Map(); // індекс секції → масив елементів
    animEls.forEach((el) => {
      const sectionEl = el.closest('[data-kulbit-section]');
      const idx = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;
      if (!bySection.has(idx)) bySection.set(idx, []);
      bySection.get(idx).push(el);
    });

    bySection.forEach((els, idx) => {
      const section = app.sections[idx];
      if (!section) return;
      section.timeline = app.buildSectionTimeline(els);
      section.isAnimated = true;
      console.log(`[Kulbit-Anim] desktop секція ${idx}: таймлайн, елементів: ${els.length}`);
    });
  };

  // 03b — Спец hero (ADR-011) для Tablet (768-991) ТА Mobile (≤479) — та сама хореографія.
  //   3 кроки; останній сплітається зі стекінгом секції 1.
  //   крок1: -tablet атрибути (контент вниз+згас, header вгору, відео scale 1.3→1);
  //   крок2: відео .hero-video → 16:9 (height) + секція 2 наповзає під 16:9 + кнопка в центр 16:9;
  //   крок3: секція 2 повністю накриває (= перехід на секцію 1).
  app.buildTabletHero = () => {
    const hero = app.sections[0];
    const section2 = app.sections[1] && app.sections[1].el;
    if (!hero || !section2) { console.warn('[Kulbit-Tablet] немає hero / секції 2'); return; }
    const heroVideo = hero.el.querySelector('.hero-video');
    if (!heroVideo) { console.warn('[Kulbit-Tablet] немає .hero-video'); return; }
    const btn = hero.el.querySelector('.hero-video-button');

    const STEP = app.config.stepDuration, SCROLL = app.config.scrollDuration, EASE = app.config.ease;
    const SUF = '-tablet';
    const has = (el, n) => el.hasAttribute('data-kulbit-' + n + SUF);
    const v = (el, n, fb) => num(el, 'data-kulbit-' + n + SUF, fb);
    const sel = `[data-kulbit-y${SUF}],[data-kulbit-scale${SUF}],[data-kulbit-fade${SUF}]`;
    const header = document.querySelector('[data-kulbit-header]');
    const els = [...hero.el.querySelectorAll(sel)];
    if (header && header.matches(sel)) els.push(header);

    // Початкові стани (крок 0)
    els.forEach((el) => {
      const s = {};
      if (has(el, 'y')) s.yPercent = 0;
      if (has(el, 'scale')) { s.scale = v(el, 'scale-from', 1); s.transformOrigin = '50% 50%'; }
      if (has(el, 'fade')) s.autoAlpha = 1;
      gsap.set(el, s);
    });
    gsap.set(heroVideo, { bottom: 'auto', height: heroVideo.clientHeight });
    gsap.set(section2, { yPercent: 100 });
    if (btn) gsap.set(btn, { y: 0 });

    // Геометрія 16:9. ВАЖЛИВО: висоти беремо з РЕНДЕРУ елементів, а не з window.innerHeight.
    //   На мобілці адресний бар робить 100vh (CSS) != innerHeight (JS): якщо рахувати
    //   зсув секції 2 від innerHeight, а сама секція має height:100vh — між відео та
    //   секцією зʼявляється смуга (видно фон сайту). Тож partial рахуємо від offsetHeight
    //   самої секції 2 → top секції стає рівно під 16:9-відео.
    const video16h = Math.round(heroVideo.clientWidth * 9 / 16);
    const partial = (video16h / section2.offsetHeight) * 100;
    // Видима висота = фіксований вьюпорт (#smooth-wrapper), а не innerHeight/100vh
    const visibleH = app.wrapper ? app.wrapper.clientHeight : window.innerHeight;
    // Центр кнопки: крок1 — центр видимого екрана; крок2 — центр 16:9-смуги (top-anchored)
    let btnYScreen = 0, btnY16 = 0;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const btnCenter = r.top + r.height / 2;
      btnYScreen = (visibleH / 2) - btnCenter;  // крок1
      btnY16 = (video16h / 2) - btnCenter;       // крок2
    }

    // Таймлайн із мітками
    const tl = gsap.timeline({ paused: true });
    els.forEach((el) => { // КРОК 1 (усе разом)
      const to = { duration: STEP, ease: EASE };
      if (has(el, 'y')) to.yPercent = v(el, 'y', 0);
      if (has(el, 'scale')) to.scale = v(el, 'scale', 1);
      if (has(el, 'fade')) to.autoAlpha = v(el, 'fade', 0);
      tl.to(el, to, 0);
    });
    if (btn) tl.to(btn, { y: btnYScreen, duration: STEP, ease: EASE }, 0); // КРОК 1: кнопка в центр екрана
    tl.addLabel('s1');
    tl.to(heroVideo, { height: video16h, duration: STEP, ease: EASE }, 's1'); // КРОК 2
    tl.to(section2, { yPercent: partial, duration: STEP, ease: EASE }, 's1');
    if (btn) tl.to(btn, { y: btnY16, duration: STEP, ease: EASE }, 's1'); // КРОК 2: кнопка в центр 16:9
    tl.addLabel('s2');
    tl.to(section2, { yPercent: 0, duration: SCROLL, ease: EASE }, 's2'); // КРОК 3 (накриття)
    tl.addLabel('s3');

    hero.tabletTL = tl;
    hero.isTabletHero = true;
    app.currentStep = 0;
    console.log('[Kulbit-Tablet] hero готовий: 16:9', video16h, 'partial', Math.round(partial));
  };

  // 03c — Таблет-hero крокування (ADR-011). Повертає true, якщо жест оброблено.
  app.tabletHeroStep = (dir) => {
    const hero = app.sections[0];
    const tl = hero.tabletTL;
    const labels = [0, 's1', 's2', 's3'], MAX = 3;
    const idx = app.currentSectionIndex;

    if (idx === 0) { // на hero — крокуємо таймлайн
      if (dir > 0 && app.currentStep < MAX) {
        app.isAnimating = true;
        const ns = app.currentStep + 1;
        tl.tweenTo(labels[ns], { onComplete: () => {
          app.isAnimating = false;
          if (ns === MAX) { app.currentSectionIndex = 1; app.currentStep = 0; if (app.updateVideoVisibility) app.updateVideoVisibility(); }
          else app.currentStep = ns;
        } });
      } else if (dir < 0 && app.currentStep > 0) {
        app.isAnimating = true;
        const ns = app.currentStep - 1;
        tl.tweenTo(labels[ns], { onComplete: () => { app.isAnimating = false; app.currentStep = ns; } });
      }
      return true; // hero повністю під контролем таблет-логіки
    }
    if (idx === 1 && dir < 0) { // повернення з секції 2 — відмотуємо хореографію hero
      app.isAnimating = true;
      app.currentSectionIndex = 0;
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      tl.tweenTo(labels[MAX - 1], { onComplete: () => { app.isAnimating = false; app.currentStep = MAX - 1; } });
      return true;
    }
    return false; // решта — стандартний стекінг
  };

  // 03d — Секція is-our-clients (ДЕСКТОП, ADR-013): 3 набори карток (вертикальний свап) +
  //   прогрес-бар + скрамбл текстів. Поява секції → прогрес 0→1/3 + скрамбл H2/label; кроки →
  //   набори 2,3 (на 3-му перепис обох параграфів); після 3-го наступний скрол = наступна секція.
  //   Стан і методи живуть у section.oc; advance/goToSection делегують на них.
  app.buildOurClients = () => {
    const section = app.sections.find((s) => s.el.classList.contains('is-our-clients'));
    if (!section) return;
    const el = section.el;
    const wraps = [...el.querySelectorAll('.our-client-card-wrapper')];
    if (wraps.length < 2) { console.warn('[Kulbit-OC] замало наборів карток'); return; }
    const bar = el.querySelector('.section-progresbar');
    const paras = [...el.querySelectorAll('.our-clients-text-content .width-193 p')];
    const paraWraps = [...el.querySelectorAll('.our-clients-text-content .width-193')];
    const h2 = el.querySelector('.text-size-section-h2');
    const label = el.querySelector('.text-size-section-label');

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const SC = (chars, speed) => ({ chars: chars || 'upperCase', speed: speed || 1 });
    const MAX = wraps.length - 1;

    // Нові тексти параграфів (RAW з пробілами; пробіл стане статичним розділювачем між спанами)
    const TXT = [
      { orig: [['Brand work', 'text-color-black-20'], [' trusted by industry leaders.', '']],
        next: [['Festival-recognized cinematic work.', 'text-color-black-20']] },
      { orig: [['Partnerships at', 'text-color-black-20'], [' scale and quality.', '']],
        next: [['Honored by', 'text-color-black-20'], [' leading international film festivals.', '']] }
    ];

    // Фіксуємо висоту обгорток параграфів — щоб абсолютний елемент не з'їжджав при стиранні
    paraWraps.forEach((w) => { w.style.height = ''; w.style.height = w.offsetHeight + 'px'; });

    // Прогрес-бар: трек 15% + дочірня лінія-заповнення 100%
    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      fill = bar.querySelector('.oc-fill');
      if (!fill) { fill = document.createElement('div'); fill.className = 'oc-fill'; bar.appendChild(fill); }
      Object.assign(fill.style, { position: 'absolute', left: '0', top: '0', height: '100%', width: '0%', backgroundColor: '#fdfcfc' });
      gsap.set(fill, { width: '0%' });
    }

    // — Скрамбл-утиліти —
    const parseSegments = (e) => {
      const segs = [];
      e.childNodes.forEach((n) => {
        if (n.nodeType === 3) segs.push([n.textContent, '']);
        else if (n.nodeType === 1) segs.push([n.textContent, n.getAttribute('class') || '']);
      });
      return segs;
    };
    // Порожні (або заповнені) спани + статичні пробіли між ними; повертає [span, цільовий-текст]
    const buildSegDOM = (c, segs, fillText) => {
      c.textContent = '';
      const targets = [];
      let pend = false;
      segs.forEach(([raw, cls]) => {
        const lead = /^\s/.test(raw), trail = /\s$/.test(raw);
        const t = raw.replace(/\s+/g, ' ').trim();
        if (lead) pend = true;
        if (t) {
          if (pend) c.appendChild(document.createTextNode(' '));
          pend = false;
          const s = document.createElement('span');
          if (cls) s.className = cls;
          if (fillText) s.textContent = t;
          c.appendChild(s);
          targets.push([s, t]);
        }
        if (trail) pend = true;
      });
      return targets;
    };
    // Скрамбл-IN на місці (текст не міняється): порожньо → написати → відновити точний HTML
    const scrambleIn = (e, dur) => {
      const original = e.innerHTML;
      e.style.height = e.offsetHeight + 'px';
      const targets = buildSegDOM(e, parseSegments(e), false);
      const tl = gsap.timeline({ onComplete: () => { e.innerHTML = original; e.style.height = ''; } });
      targets.forEach(([s, t]) => tl.to(s, { duration: dur, scrambleText: { text: t, ...SC() } }, 0));
    };
    // Перепис параграфа: стерти все → нові сегменти → написати скрамблом
    const morphParagraph = (p, segs) => {
      gsap.killTweensOf(p);
      gsap.to(p, {
        duration: 0.35, scrambleText: { text: '', ...SC('upperCase', 3) },
        onComplete: () => buildSegDOM(p, segs, false).forEach(([s, t]) => gsap.to(s, { duration: 0.6, scrambleText: { text: t, ...SC() } }))
      });
    };
    const morphTexts = (toNext) => paras.forEach((p, i) => morphParagraph(p, toNext ? TXT[i].next : TXT[i].orig));
    const setTexts = (toNext) => paras.forEach((p, i) => buildSegDOM(p, toNext ? TXT[i].next : TXT[i].orig, true)); // миттєво, без скрамблу

    // — Свап наборів + заповнення прогресу —
    const setCards = (s, animate) => wraps.forEach((w, i) => {
      const y = i < s ? -100 : (i > s ? 100 : 0);
      if (animate) gsap.to(w, { yPercent: y, duration: STEP, ease: EASE });
      else gsap.set(w, { yPercent: y });
    });
    const setFill = (s, animate) => {
      if (!fill) return;
      const w = ((s + 1) / wraps.length * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };

    let state = 0;
    setCards(0, false);
    setTexts(false);

    section.isOurClients = true;
    section.oc = {
      get state() { return state; },
      // Миттєвий стан при вході знизу (toEnd=true → набір 3, прогрес повний, тексти next)
      reset(toEnd) {
        state = toEnd ? MAX : 0;
        setCards(state, false);
        setFill(state, false);
        setTexts(state === MAX);
      },
      // Поява згори: прогрес 0→1/3, набір 1, скрамбл H2 + label (зберігаючи спани)
      enter() {
        state = 0;
        setCards(0, false);
        setTexts(false);
        if (fill) gsap.set(fill, { width: '0%' });
        setFill(0, true);
        if (h2) scrambleIn(h2, 1.2);
        if (label) scrambleIn(label, 1.2);
      },
      // Крок усередині секції; true якщо оброблено (false → межа, далі сусідня секція)
      step(dir) {
        const ns = Math.max(0, Math.min(MAX, state + dir));
        if (ns === state) return false;
        const prev = state; state = ns;
        app.isAnimating = true;
        setCards(state, true);
        setFill(state, true);
        gsap.delayedCall(STEP, () => { app.isAnimating = false; });
        if (prev === 1 && state === 2) morphTexts(true);   // у набір 3 → новий текст
        if (prev === 2 && state === 1) morphTexts(false);  // назад → оригінал
        return true;
      }
    };
    console.log('[Kulbit-OC] desktop готовий, наборів:', wraps.length);
  };

  // 04 — Побудова паузованого таймлайну секції з атрибутів.
  //      Початковий стан (крок 0) виставляється gsap.set; крок 1 — це кінець таймлайну.
  //      Фази задаються data-kulbit-order (0 — перша, далі — послідовно). Без order — усе разом.
  app.buildSectionTimeline = (els) => {
    // Початковий стан (крок 0)
    els.forEach((el) => {
      const start = {};
      if (el.hasAttribute('data-kulbit-y')) start.yPercent = 0;
      if (el.hasAttribute('data-kulbit-scale')) {
        start.scale = num(el, 'data-kulbit-scale-from', 1);
        start.transformOrigin = '50% 50%';
      }
      if (el.hasAttribute('data-kulbit-fade')) start.autoAlpha = 1;
      gsap.set(el, start);
    });

    const orderOf = (el) => parseInt(el.getAttribute('data-kulbit-order') || '0', 10);
    const orders = [...new Set(Array.from(els, orderOf))].sort((a, b) => a - b);

    const tl = gsap.timeline({
      paused: true,
      defaults: { duration: app.config.stepDuration, ease: app.config.ease },
      onComplete: () => { app.isAnimating = false; },
      onReverseComplete: () => { app.isAnimating = false; }
    });

    // Фази по черзі ('>' — після попередньої); всередині фази — одночасно ('<')
    orders.forEach((ord, gi) => {
      els.filter((el) => orderOf(el) === ord).forEach((el, i) => {
        const to = {};
        if (el.hasAttribute('data-kulbit-y')) to.yPercent = num(el, 'data-kulbit-y', 0);
        if (el.hasAttribute('data-kulbit-scale')) to.scale = num(el, 'data-kulbit-scale', 1);
        if (el.hasAttribute('data-kulbit-fade')) to.autoAlpha = num(el, 'data-kulbit-fade', 0);
        tl.to(el, to, i === 0 ? (gi === 0 ? 0 : '>') : '<');
      });
    });

    return tl;
  };

  // — Стекінг-лейаут (ADR-010): секції абсолютом одна над одною, z-index за індексом.
  //   JS застосовує це в РАНТАЙМІ — у Webflow секції лишаються relative (зручно редагувати).
  app.setupStacking = () => {
    if (app.content) {
      app.content.style.position = 'relative';
      app.content.style.height = '100vh';
    }
    app.sections.forEach((s) => {
      Object.assign(s.el.style, {
        position: 'absolute', top: '0', left: '0', width: '100%', height: '100vh'
      });
      s.el.style.zIndex = String(s.index); // наступна секція — вище
    });
    app.applyStackingPositions(); // початковий стан
    console.log('[Kulbit-Stack] лейаут стекінгу застосовано, секцій:', app.sections.length);
  };

  // — Дискретні позиції стекінгу: секції 0..current накладені (y:0), решта під екраном (y:100%).
  app.applyStackingPositions = () => {
    app.sections.forEach((s) => {
      gsap.set(s.el, { yPercent: s.index <= app.currentSectionIndex ? 0 : 100 });
    });
  };

  // 05 — Стан reveal-кроків секції: shown=false → усі сховані; true → усі показані.
  app.resetSteps = (section, shown) => {
    if (!section.isStepped) return;
    section.steps.forEach((el) => {
      gsap.set(el, shown ? { autoAlpha: 1, y: 0 } : { autoAlpha: 0, y: 40 });
    });
  };

  // 06 — Програти reveal-крок i
  app.playStep = (section, i) => {
    const el = section.steps[i];
    if (!el) return;
    app.isAnimating = true;
    gsap.to(el, {
      autoAlpha: 1, y: 0,
      duration: app.config.stepDuration, ease: app.config.ease,
      onComplete: () => { app.isAnimating = false; }
    });
    console.log('[Kulbit-Steps] ▶ крок', i, '(секція', section.index + ')');
  };

  // 07 — Відмотати reveal-крок i (сховати)
  app.reverseStep = (section, i) => {
    const el = section.steps[i];
    if (!el) return;
    app.isAnimating = true;
    gsap.to(el, {
      autoAlpha: 0, y: 40,
      duration: app.config.stepDuration, ease: app.config.ease,
      onComplete: () => { app.isAnimating = false; }
    });
    console.log('[Kulbit-Steps] ◀ крок', i, '(секція', section.index + ')');
  };

  // 08 — Перехід на секцію (СТЕКІНГ, ADR-010): секції накладаються одна на одну.
  //      Вниз — ціль наповзає знизу (yPercent 100→0) поверх поточної (вона лишається на місці);
  //      вгору — поточна сповзає вниз (0→100), відкриваючи попередню (вона під нею на 0).
  //      dir задає стан кроків нової секції: згори (dir>0) → на початку; знизу (dir<0) → у кінці.
  app.goToSection = (index, instant, dir) => {
    if (!app.sections.length) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const prev = app.currentSectionIndex;
    if (clamped === prev && !instant) return; // межа — нікуди не йдемо

    const target = app.sections[clamped];

    // Стан кроків/таймлайну нової секції
    if (target.isOurClients && target.oc) {
      app.currentStep = 0; // власний стан — у target.oc (виставляємо в instant/animated нижче)
    } else if (target.isAnimated && target.timeline) {
      const atEnd = dir < 0;                       // вхід знизу → таймлайн у кінці
      target.timeline.progress(atEnd ? 1 : 0).pause();
      app.currentStep = atEnd ? 1 : 0;
    } else if (target.isStepped) {
      const shown = dir < 0;
      app.resetSteps(target, shown);
      app.currentStep = shown ? target.steps.length : 0;
    } else {
      app.currentStep = 0;
    }

    if (instant) {
      app.currentSectionIndex = clamped;
      app.applyStackingPositions();
      if (target.isOurClients && target.oc) target.oc.reset(dir < 0); // миттєвий стан секції
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      return;
    }

    app.isAnimating = true;
    app.currentSectionIndex = clamped;
    // Відео нової поточної секції — показуємо ОДРАЗУ (грає, поки секція наповзає/відкривається).
    if (app.showCurrentVideo) app.showCurrentVideo();
    const finish = () => {
      app.isAnimating = false;
      // Відео накритих секцій — пауза САМЕ КОЛИ перехід завершився (секція торкнулась верху екрана),
      // а не на початку наповзання. На таблеті/мобілці пауза вже в onComplete кроку 3 (tabletHeroStep).
      if (app.hideOtherVideos) app.hideOtherVideos();
    };
    if (dir > 0) {
      // вниз: ціль наповзає знизу поверх поточної
      if (target.isOurClients && target.oc) target.oc.enter(); // поява: прогрес 0→1/3 + скрамбл заголовків
      gsap.to(target.el, {
        yPercent: 0,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: finish
      });
    } else {
      // вгору: поточна сповзає вниз, відкриваючи попередню
      if (target.isOurClients && target.oc) target.oc.reset(true); // секцію відкривають на набір 3 (кінець)
      gsap.to(app.sections[prev].el, {
        yPercent: 100,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: finish
      });
    }
    console.log('[Kulbit-Nav] секція', prev, '→', clamped);
  };

  // 09 — advance: вирішує — наступний КРОК у поточній секції чи перехід на СЕКЦІЮ.
  //      Викликається обробником жесту (02-app-core.js) та кнопками.
  app.advance = (dir) => {
    // Таблет-hero (ADR-011) бере на себе крокування + межу з секцією 1
    const hero = app.sections[0];
    if (hero && hero.isTabletHero && app.tabletHeroStep(dir)) return;

    const section = app.sections[app.currentSectionIndex];

    // is-our-clients (ADR-013, десктоп): покрокова хореографія всередині секції
    if (section.isOurClients && section.oc) {
      if (section.oc.step(dir)) return;                       // крок усередині оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // Кастомний таймлайн desktop (hero): крок 0 ↔ 1
    if (section.isAnimated && section.timeline) {
      if (dir > 0 && app.currentStep < 1) {
        app.isAnimating = true;
        app.currentStep = 1;
        section.timeline.play();
        console.log('[Kulbit-Anim] ▶ таймлайн секції', section.index);
        return;
      }
      if (dir < 0 && app.currentStep > 0) {
        app.isAnimating = true;
        app.currentStep = 0;
        section.timeline.reverse();
        console.log('[Kulbit-Anim] ◀ reverse секції', section.index);
        return;
      }
    }

    // Reveal-кроки
    if (section.isStepped) {
      if (dir > 0 && app.currentStep < section.steps.length) {
        app.playStep(section, app.currentStep);
        app.currentStep++;
        return;
      }
      if (dir < 0 && app.currentStep > 0) {
        app.currentStep--;
        app.reverseStep(section, app.currentStep);
        return;
      }
    }

    // Кроків у цьому напрямі немає → міняємо секцію (стекінг)
    app.goToSection(app.currentSectionIndex + dir, false, dir);
  };

  // 10 — Перехід на секцію + конкретний крок (для кнопок data-target-step), стекінг.
  //      Секції 0..clamped виставляємо накладеними (y:0), решту — під екраном (y:100%).
  app.goToSectionStep = (index, targetStep) => {
    if (!app.sections.length) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const section = app.sections[clamped];
    const maxStep = section.isAnimated ? 1 : (section.isStepped ? section.steps.length : 0);
    const step = Math.max(0, Math.min(targetStep || 0, maxStep));

    app.currentSectionIndex = clamped;
    app.currentStep = step;

    // Стекінг-позиції (анімовано)
    app.isAnimating = true;
    let pending = 0;
    app.sections.forEach((s) => {
      pending++;
      gsap.to(s.el, {
        yPercent: s.index <= clamped ? 0 : 100,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => { if (--pending === 0) app.isAnimating = false; }
      });
    });

    // Стан кроків
    if (section.isAnimated && section.timeline) {
      section.timeline.progress(step >= 1 ? 1 : 0).pause();
    } else if (section.isStepped) {
      section.steps.forEach((el, i) => {
        if (i < step) {
          gsap.to(el, { autoAlpha: 1, y: 0, duration: app.config.autoPlayStepDuration, ease: app.config.ease });
        } else {
          gsap.set(el, { autoAlpha: 0, y: 40 });
        }
      });
    }
    console.log('[Kulbit-Nav] → секція', clamped, 'крок', step);
  };
})();


// ====================================================================
// 04-navigation.js — Кнопки-переходи (data-target-section / data-target-step)
//                    Делегування: працює для будь-яких кнопок, доданих будь-коли
// ====================================================================

console.log('[Kulbit] 04-navigation.js завантажено');

// ## — Обробник кнопок-переходів
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // 01 — Резолв цілі: число → прямий індекс; рядок → пошук секції з data-section-name.
  //      Іменовані якорі стійкі до реордеру секцій — рекомендовано для клієнтських кнопок.
  const resolveIndex = (target) => {
    if (target === null) return -1;
    if (/^\d+$/.test(target)) return parseInt(target, 10);
    const found = app.sections.find((s) => s.el.getAttribute('data-section-name') === target);
    return found ? found.index : -1;
  };

  // 02 — Делегований клік по всьому документу (ловить і майбутні кнопки з Webflow)
  const onClick = (e) => {
    const trigger = e.target.closest('[data-target-section]');
    if (!trigger) return;
    e.preventDefault();

    const index = resolveIndex(trigger.getAttribute('data-target-section'));
    if (index < 0) {
      console.warn('[Kulbit-Nav] ціль не знайдено:', trigger.getAttribute('data-target-section'));
      return;
    }

    // Якщо вказано data-target-step — перехід на секцію + конкретний крок
    const stepAttr = trigger.getAttribute('data-target-step');
    if (stepAttr !== null) {
      console.log('[Kulbit-Nav] клік → секція', index, 'крок', stepAttr);
      app.goToSectionStep(index, parseInt(stepAttr, 10));
    } else {
      console.log('[Kulbit-Nav] клік → секція', index);
      app.goToSection(index);
    }
  };

  document.addEventListener('click', onClick);
  console.log('[Kulbit-Nav] ✅ Обробник кнопок-переходів активний (делегування)');
})();


// ====================================================================
// 05-header.js — Логіка зникання абсолютного хедера при анімаціях
// ====================================================================

console.log('[Kulbit] 05-header.js завантажено');

// Тут буде логіка хедера (Крок 7)


// ====================================================================
// 06-responsive.js — Респонсив: попап «поверни пристрій» для landscape-телефону
//
//   ADR-004: на телефоні в landscape контент покрокових анімацій не вміщається
//   (висота ~375px). Тому показуємо повноекранний оверлей «поверни пристрій»
//   і ВИМИКАЄМО fullpage (Observer), поки девайс горизонтально.
//
//   Розмітка: обгортка попапа — [data-kulbit-landscape-popup]; у Webflow
//   Display: None за замовчуванням (показ керує JS), має бути fixed overlay.
//
//   Детект — ПО ОРІЄНТАЦІЇ (а не лише ширині): landscape + низька висота + тач.
//   Так ловимо будь-який телефон у landscape (навіть широкий, що по ширині падає
//   в «таблет»), а планшети (висота > max) і десктоп (pointer: fine) — ні.
// ====================================================================

console.log('[Kulbit] 06-responsive.js завантажено');

// ## — Попап «поверни пристрій» для landscape-телефону
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  document.addEventListener('DOMContentLoaded', () => {
    const popup = document.querySelector('[data-kulbit-landscape-popup]');
    if (!popup) {
      console.log('[Kulbit-Responsive] попапа [data-kulbit-landscape-popup] немає — пропускаємо');
      return;
    }

    const maxH = (app.config && app.config.landscapeMaxHeight) || 500;
    const mql = window.matchMedia(
      `(orientation: landscape) and (max-height: ${maxH}px) and (pointer: coarse)`
    );

    // — Виставити стан сайту за поточною орієнтацією.
    //   Перебудову hero при зміні брейкпоінта/орієнтації робить gsap.matchMedia (03-sections.js),
    //   тут лише попап + Observer + прапорець landscapeBlocked (його поважає логіка відео).
    const apply = () => {
      if (mql.matches) {
        // landscape-телефон: попап ON, fullpage OFF, усе відео на паузі
        app.landscapeBlocked = true;
        popup.style.display = 'flex';
        if (app.observer) app.observer.disable();
        if (app.updateVideoVisibility) app.updateVideoVisibility(); // landscapeBlocked → пауза всіх
        console.log('[Kulbit-Responsive] landscape-телефон: попап ON, fullpage OFF');
      } else {
        // портрет / не-телефон: попап OFF, fullpage ON
        app.landscapeBlocked = false;
        popup.style.display = 'none';
        if (app.observer) app.observer.enable();
        if (app.updateVideoVisibility) app.updateVideoVisibility();
        console.log('[Kulbit-Responsive] портрет: попап OFF, fullpage ON');
      }
    };

    mql.addEventListener('change', apply);
    // Початковий стан — наступним тіком, щоб 08-video.js встиг заповнити app.videos
    setTimeout(apply, 0);
    console.log('[Kulbit-Responsive] детект landscape активний (max-height', maxH + 'px)');
  });
})();


// ====================================================================
// 07-popup-form.js — Логіка попап-форми
// ====================================================================

console.log('[Kulbit] 07-popup-form.js завантажено');

// Тут буде попап-форма (Крок 9)


// ====================================================================
// 08-video.js — Vimeo фонове відео: cover + перемикач звуку + пауза/звук по видимості
//
//   Відео ЗАВЖДИ вставляється як <iframe> у Webflow Embed (НЕ через JS).
//   Розмітка:
//   • контейнер: [data-kulbit-video], усередині — <iframe> Vimeo;
//     у src ОБОВ'ЯЗКОВО &background=1 (autoplay + loop + muted + без UI),
//     unlisted-відео → ?h=<хеш> у src.
//   • кнопка звуку (опційно, у тій же секції): [data-kulbit-sound] з іконками
//     .icon-24-24-16 (динамік) та .icon-24-24-16.is-mute (перекреслена).
//
//   Пауза/звук по видимості: відео грає лише коли його секція поточна (не накрита
//   стекінгом). Накрилось → пауза + мут; повернулось → грає + звук як був (намір
//   користувача soundOn). updateVideoVisibility() кличе навігація (03-sections.js).
// ====================================================================

console.log('[Kulbit] 08-video.js завантажено');

// ## — Фонове Vimeo-відео
(() => {
  const ASPECT = 16 / 9; // співвідношення відео (для cover-розрахунку)

  // 01 — cover: розмір iframe так, щоб 16:9 ПОКРИВАЛО контейнер; зайве ховає overflow:hidden.
  //      Рахуємо від контейнера (не вьюпорта) — тримається й під час scale/16:9-анімації.
  const applyCover = (box, iframe) => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    let iw, ih;
    if (w / h > ASPECT) { iw = w; ih = w / ASPECT; } // ширший за 16:9 → тягнемо по ширині
    else                { ih = h; iw = h * ASPECT; } // вищий/вужчий → тягнемо по висоті
    Object.assign(iframe.style, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: iw + 'px', height: ih + 'px', maxWidth: 'none'
    });
  };

  // 02 — Стан іконок: muted → перекреслена (.is-mute); звук → динамік (.icon-24-24-16)
  const setSoundIcons = (btn, muted, animate) => {
    const iSound = btn.querySelector('.icon-24-24-16:not(.is-mute)');
    const iMute = btn.querySelector('.icon-24-24-16.is-mute');
    const dur = animate ? 0.2 : 0;
    if (iSound) gsap.to(iSound, { autoAlpha: muted ? 0 : 1, duration: dur });
    if (iMute) gsap.to(iMute, { autoAlpha: muted ? 1 : 0, duration: dur });
  };

  // 03 — Ініціалізація одного відео-блоку. Повертає запис { player, sectionIndex, show, hide }.
  const initVideo = (box) => {
    box.style.position = 'relative';
    box.style.overflow = 'hidden';

    let iframe = box.querySelector('iframe');
    if (!iframe) {
      console.error('[Kulbit-Video] ❌ у [data-kulbit-video] немає <iframe> — встав ембед Vimeo з &background=1');
      return null;
    }
    // Витягуємо iframe зі стандартної padding-обгортки Vimeo (56.25%), якщо є
    if (iframe.parentElement && iframe.parentElement !== box) {
      const wrap = iframe.parentElement;
      box.appendChild(iframe);
      wrap.remove();
    }

    const player = new Vimeo.Player(iframe);

    player.ready().then(() => {
      applyCover(box, iframe);
      new ResizeObserver(() => applyCover(box, iframe)).observe(box);
      console.log('[Kulbit-Video] ✅ плеєр готовий (cover активний)');
    }).catch((e) => console.error('[Kulbit-Video] ❌ помилка завантаження:', e));

    let soundOn = false; // намір користувача (старт muted; autoplay вимагає muted)
    const sectionEl = box.closest('[data-kulbit-section]');
    const sectionIndex = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;

    // Кнопка звуку (у тій же секції; може бути відсутня)
    const btn = (sectionEl || document).querySelector('[data-kulbit-sound]');
    if (btn) {
      setSoundIcons(btn, true, false); // старт muted (перекреслена)
      btn.addEventListener('click', () => {
        soundOn = !soundOn;
        player.setMuted(!soundOn);
        setSoundIcons(btn, !soundOn, true);
        console.log('[Kulbit-Video] звук:', soundOn);
      });
    }

    return {
      player, sectionIndex,
      show: () => { player.play(); player.setMuted(!soundOn); }, // грати + звук як хотів користувач
      hide: () => { player.pause(); player.setMuted(true); }     // пауза + примусовий мут
    };
  };

  // 04 — Пауза/звук по видимості. Розділено на show/hide, бо таймінг різний:
  //      показати поточне відео — ОДРАЗУ (грає, поки секцію наповзає/відкривають);
  //      сховати накриті — на ЗАВЕРШЕННІ переходу (секція торкнулась верху екрана) — див. goToSection.
  //      landscapeBlocked (06-responsive.js): у landscape-попапі відео завжди на паузі.
  window.KulbitApp = window.KulbitApp || {};

  window.KulbitApp.showCurrentVideo = () => {
    const app = window.KulbitApp;
    if (app.landscapeBlocked) return; // landscape-попап — нічого не граємо
    (app.videos || []).forEach((rec) => {
      if (rec.sectionIndex === app.currentSectionIndex) rec.show();
    });
  };

  window.KulbitApp.hideOtherVideos = () => {
    const app = window.KulbitApp;
    (app.videos || []).forEach((rec) => {
      if (app.landscapeBlocked || rec.sectionIndex !== app.currentSectionIndex) rec.hide();
    });
  };

  // Повне миттєве оновлення (миттєві переходи, попап, init): спершу сховати зайве, тоді показати поточне.
  window.KulbitApp.updateVideoVisibility = () => {
    window.KulbitApp.hideOtherVideos();
    window.KulbitApp.showCurrentVideo();
  };

  // 05 — Старт після готовності DOM
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Vimeo === 'undefined') {
      console.error('[Kulbit-Video] ❌ Vimeo Player SDK не підключено (player.js перед бандлом)');
      return;
    }
    const boxes = document.querySelectorAll('[data-kulbit-video]');
    if (!boxes.length) {
      console.log('[Kulbit-Video] відео-блоків [data-kulbit-video] немає');
      return;
    }
    const app = window.KulbitApp = window.KulbitApp || {};
    app.videos = app.videos || [];
    boxes.forEach((box) => {
      const rec = initVideo(box);
      if (rec) app.videos.push(rec);
    });
  });
})();


// ====================================================================
// 09-button-border.js — Ховер-ефект: промальовка кольорового бордера
//                       від точки курсора (матова лінія + opacity).
//                       Вішається на елементи з атрибутом [data-kulbit-border].
// ====================================================================

console.log('[Kulbit] 09-button-border.js завантажено');

// ## — Промальовка бордера від точки ховера
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const SELECTOR = '[data-kulbit-border]';

  // Конфіг ефекту (усі magic numbers — тут)
  const config = {
    duration: 0.3,  // тривалість промальовки / згортання
    ease: 'none',   // лінійний easing
    sampleN: 64,    // точність пошуку точки входу на периметрі
    offset: 0       // зсув штриха назовні від центру бордера (px); 0 = рівно по бордеру
  };

  // Колір зі змінної проєкту (з фолбеком)
  const getBlue = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--colors--blue').trim() || '#62b0ff';

  // ## — Налаштування одного елемента. Повертає функцію rebuild (для resize).
  const setupElement = (el) => {
    const blue = getBlue();
    const state = { p: 0, center: 0, mode: 'hover', rect: null, svg: null, L: 0, w: 0, h: 0 };

    // Ховер: видимий сегмент довжиною frac*L, центрований на offset center (з обгортанням контуру)
    const draw = (center, frac) => {
      if (!state.rect) return;
      const len = frac * state.L;
      state.rect.style.strokeDasharray = `${len} ${state.L - len}`;
      state.rect.style.strokeDashoffset = `${len / 2 - center}`;
      state.rect.style.opacity = frac; // проявлення через opacity
    };

    // Фокус: повне коло (без розриву), керуємо лише прозорістю (opacity 0 -> 1)
    const drawFull = (frac) => {
      if (!state.rect) return;
      state.rect.style.strokeDasharray = `${state.L} 0`;
      state.rect.style.strokeDashoffset = '0';
      state.rect.style.opacity = frac;
    };

    // Рендер за поточним режимом (ховер — від курсора; фокус — повне коло)
    const render = () => {
      if (state.mode === 'focus') drawFull(state.p);
      else draw(state.center, state.p);
    };

    // Перебудова SVG-оверлея під поточні розміри (init + resize)
    const build = () => {
      const cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      // offsetWidth/offsetHeight — ЛЕЙАУТ-розмір box (для viewBox + координат rect), імунний до transform.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      // Товщина лінії = outline-width (кнопка тепер з outline, а не border); фолбек на border / 2.
      const sw = parseFloat(cs.outlineWidth) || parseFloat(cs.borderTopWidth) || 2;
      const r = parseFloat(cs.borderTopLeftRadius) || 0; // радіус кутів

      if (state.svg) state.svg.remove();

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      // Кнопка БЕЗ бордера (outline + outline-offset:-Npx) → її box = видимий край. Тому SVG заповнює
      // box через width/height:100% — percentage рахується від containing block у ЛЕЙАУТ-просторі
      // (дробово, точно, transform-safe; SVG масштабується разом із кнопкою) — БЕЗ вимірів px.
      // preserveAspectRatio:none → viewBox розтягується рівно під фактичний box, rect трасує периметр.
      const off = config.offset;
      Object.assign(svg.style, {
        position: 'absolute',
        top: '0', left: '0', width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'visible', zIndex: '2'
      });

      const i = sw / 2;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', i - off);                    // off>0 → штрих назовні від центру бордера
      rect.setAttribute('y', i - off);
      rect.setAttribute('width', (w - sw) + 2 * off);
      rect.setAttribute('height', (h - sw) + 2 * off);
      rect.setAttribute('rx', Math.max(0, r - i + off));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', blue);
      rect.setAttribute('stroke-width', sw);
      svg.appendChild(rect);
      el.appendChild(svg);

      state.svg = svg;
      state.rect = rect;
      state.w = w;
      state.h = h;
      state.L = rect.getTotalLength();
      render(); // відновлюємо поточний стан (за режимом) після перебудови
    };

    // Найближча до курсора точка периметра (offset уздовж контуру)
    const offsetFromMouse = (e) => {
      const b = el.getBoundingClientRect();
      const mx = (e.clientX - b.left) * (state.w / b.width);
      const my = (e.clientY - b.top) * (state.h / b.height);
      let best = 0, bestD = Infinity;
      for (let k = 0; k <= config.sampleN; k++) {
        const pt = state.rect.getPointAtLength((k / config.sampleN) * state.L);
        const d = (pt.x - mx) ** 2 + (pt.y - my) ** 2;
        if (d < bestD) { bestD = d; best = (k / config.sampleN) * state.L; }
      }
      return best;
    };

    // Анімація прогресу p -> target (рендер за поточним режимом state.mode)
    const tweenP = (target) => {
      gsap.killTweensOf(state);
      gsap.to(state, {
        p: target,
        duration: config.duration,
        ease: config.ease,
        onUpdate: render
      });
    };

    // Лінія активна, поки є ховер АБО фокус. При p=1 обидва режими дають однакове повне
    // коло, тож перемикання hover<->focus у крайньому стані безшовне.
    let hovered = false, focused = false;

    el.addEventListener('mouseenter', (e) => {
      hovered = true;
      state.mode = 'hover';
      state.center = offsetFromMouse(e); // ховер — промальовка від точки курсора
      tweenP(1);
    });
    el.addEventListener('mouseleave', () => {
      hovered = false;
      if (focused) { state.mode = 'focus'; tweenP(1); } // лишилась у фокусі — тримаємо повне коло
      else tweenP(0);
    });

    // Фокус (клавіатура/клік): повне коло плавно проявляється opacity 0 -> 1
    el.addEventListener('focusin', () => {
      focused = true;
      if (!hovered) { state.mode = 'focus'; tweenP(1); }
    });
    el.addEventListener('focusout', () => {
      focused = false;
      if (!hovered) tweenP(0); // згортання (поточний режим)
    });

    build();
    return build;
  };

  // ## — Кольори hero-кнопки на ховер/фокус (текст -> --colors--white-10; currentColor у SVG -> --colors--blue).
  //      Прив'язано до КЛАСУ .button.is-hero (а не до лінії/data-kulbit-border — у hero його може й не бути).
  //      Незалежний обробник; не потребує gsap. Якщо на кнопці є й лінія — обидва реагують на ті самі події.
  const setupHeroColors = (el) => {
    let hov = false, foc = false;
    const apply = () => {
      const active = hov || foc;
      el.style.color = active ? 'var(--colors--white-10)' : '';
      el.querySelectorAll('svg').forEach((s) => { s.style.color = active ? 'var(--colors--blue)' : ''; });
    };
    el.addEventListener('mouseenter', () => { hov = true; apply(); });
    el.addEventListener('mouseleave', () => { hov = false; apply(); });
    el.addEventListener('focusin', () => { foc = true; apply(); });
    el.addEventListener('focusout', () => { foc = false; apply(); });
  };

  // ## — Ініціалізація після готовності DOM
  document.addEventListener('DOMContentLoaded', () => {
    // Кольори hero-кнопки — окремо й незалежно від лінії/gsap
    const heroBtns = document.querySelectorAll('.button.is-hero');
    heroBtns.forEach((el) => setupHeroColors(el));
    if (heroBtns.length) console.log('[Kulbit-Border] hero-кольори активні на', heroBtns.length, 'кнопці(ах)');

    if (typeof gsap === 'undefined') {
      console.error('[Kulbit-Border] ❌ GSAP не завантажений');
      return;
    }
    const els = document.querySelectorAll(SELECTOR);
    if (!els.length) {
      console.log('[Kulbit-Border] елементів [data-kulbit-border] не знайдено');
      return;
    }

    const rebuilders = Array.from(els).map((el) => setupElement(el));

    // Перебудова під нові розміри при ресайзі (debounce)
    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => rebuilders.forEach((fn) => fn()), 150);
    });

    console.log('[Kulbit-Border] ✅ ефект активний на', els.length, 'елемент(ах)');
  });
})();
