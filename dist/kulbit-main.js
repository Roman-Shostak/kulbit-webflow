/* Kulbit Webflow — dev build (з логами) — 2026-06-04T14:15:54.129Z */

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
        oc: null, isOurClients: false,       // спец секція is-our-clients (ADR-013)
        pv: null, isProjects: false,         // спец секція is-projects: свап відео (ADR-015)
        ft: null                             // спец секція footer: покроковий скрол (ADR-020)
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

    app.mm.add('(min-width: 992px)', () => {              // desktop ≥992
      app.resetHeroState();
      app.buildDesktopAnimations();
      app.buildOurClients('desktop');                    // is-our-clients (ADR-013)
      app.buildProjects('desktop');                      // is-projects: свап відео (ADR-015, поки лише desktop)
      app.buildHSwipe('desktop');                        // is-our-services: горизонтальний свап карток
      app.buildWorkingProcess('desktop');                // is-working-process: stack-cards (десktop - горизонт.)
      app.buildTraditional('desktop');                   // is-traditional-production: радар red/blue + картки (поки лише desktop)
      app.restoreSection();                              // персистентність: відновити позицію (reload/перебудова)
      return () => app.teardownHero();
    });
    app.mm.add('(min-width: 768px) and (max-width: 991px)', () => {       // tablet 768-991
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('tablet');                     // is-our-clients (ADR-013, таблет)
      app.buildProjects('tablet');                       // is-projects: свап вікном 3 (ADR-016 re-approach)
      app.buildHSwipe('tablet');                         // is-our-services: горизонтальний свап карток
      app.buildWorkingProcess('tablet');                 // is-working-process: stack-cards (Z-stack)
      app.buildFooterScroll('tablet');                   // footer: покроковий скрол якщо переповнює (ADR-020)
      app.restoreSection();                              // персистентність: відновити позицію
      return () => app.teardownHero();
    });
    app.mm.add('(max-width: 479px)', () => {             // mobile-портрет ≤479
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('mobile');                     // is-our-clients (ADR-013, мобілка: shiftN [2,1,2])
      app.buildProjects('mobile');                       // is-projects: свап вікном 3 (ADR-016 re-approach)
      app.buildHSwipe('mobile');                         // is-our-services: горизонтальний свап карток
      app.buildWorkingProcess('mobile');                 // is-working-process: stack-cards (Z-stack)
      app.buildFooterScroll('mobile');                   // footer: покроковий скрол якщо переповнює (ADR-020)
      app.restoreSection();                              // персистентність: відновити позицію
      return () => app.teardownHero();
    });
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
    if (app._heroVidCleanup) { app._heroVidCleanup(); app._heroVidCleanup = null; } // зняти слухач ресайзу відео
    app.sections.forEach((s) => {
      s.timeline = null; s.isAnimated = false;
      s.tabletTL = null; s.isTabletHero = false;
      if (s.oc && s.oc.dispose) s.oc.dispose(); // прибрати IntersectionObserver (ADR-013)
      s.oc = null; s.isOurClients = false;
      if (s.pv && s.pv.dispose) s.pv.dispose(); // прибрати свап-стан is-projects (ADR-015)
      s.pv = null; s.isProjects = false;
      if (s.hswipe && s.hswipe.dispose) s.hswipe.dispose(); // прибрати свап-стан is-our-services
      s.hswipe = null; s.isHSwipe = false;
      if (s.wp && s.wp.dispose) s.wp.dispose();             // прибрати свап-стан is-working-process
      s.wp = null; s.isWP = false;
      if (s.ft && s.ft.dispose) s.ft.dispose();             // footer-скрол: зняти слухачі + повернути вихідний лейаут
      s.ft = null;
      if (s.tp && s.tp.dispose) s.tp.dispose();             // traditional-production: прибрати маски/інжекти/display
      s.tp = null; s.isTraditional = false;
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
    // Висота hero-відео (крок 0 = на весь екран) від РЕАЛЬНОГО вьюпорта (як зовнішній hero-vh-fix),
    //   а не clientHeight: при повороті buildTabletHero спрацьовує ДО того, як hero-vh-fix виставить
    //   фінальну висоту секції → відео морозилось на проміжній/landscape висоті.
    const fullVideoH = () => (window.visualViewport && window.visualViewport.height) ||
                             (app.wrapper ? app.wrapper.clientHeight : window.innerHeight);
    const syncHeroVideoFull = () => { // оновлюємо ЛИШЕ коли hero повний (крок 0) — не ламаємо 16:9 (крок 2)
      if (app.currentSectionIndex === 0 && app.currentStep === 0) gsap.set(heroVideo, { height: fullVideoH() });
    };
    gsap.set(heroVideo, { bottom: 'auto', height: fullVideoH() });
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

    // Пересинхронізація висоти відео після повороту/зміни вьюпорта (hero-vh-fix виставляє висоту
    //   секції асинхронно). Знімаємо попередній слухач (buildTabletHero перебудовується), ставимо новий.
    if (app._heroVidCleanup) app._heroVidCleanup();
    let heroVidTimer;
    const onHeroResize = () => { clearTimeout(heroVidTimer); heroVidTimer = setTimeout(syncHeroVideoFull, 200); };
    window.addEventListener('resize', onHeroResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onHeroResize);
    app._heroVidCleanup = () => {
      clearTimeout(heroVidTimer);
      window.removeEventListener('resize', onHeroResize);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', onHeroResize);
    };
    setTimeout(syncHeroVideoFull, 250); // одразу по побудові — упіймати фінальну висоту від hero-vh-fix

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
          if (ns === MAX) {
            app.currentSectionIndex = 1; app.currentStep = 0;
            app.persistSection(); // зберегти позицію (hero → секція 1 іде в обхід goToSection)
            if (app.updateVideoVisibility) app.updateVideoVisibility();
            const s1 = app.sections[1]; // секція 1 (is-our-clients) накрила — запускаємо її появу
            if (s1 && s1.isOurClients && s1.oc) s1.oc.enter();
          } else app.currentStep = ns;
        } });
      } else if (dir < 0 && app.currentStep > 0) {
        app.isAnimating = true;
        const ns = app.currentStep - 1;
        tl.tweenTo(labels[ns], { onComplete: () => { app.isAnimating = false; app.currentStep = ns; } });
      }
      return true; // hero повністю під контролем таблет-логіки
    }
    if (idx === 1 && dir < 0) {
      const s1 = app.sections[1];
      // секція 1 = is-our-clients і ще НЕ на старті → хай OC відмотує спершу (advance викличе oc.step)
      if (s1 && s1.isOurClients && s1.oc && s1.oc.state > 0) return false;
      // OC на старті (або секція 1 звичайна) → відмотуємо хореографію hero (16:9 повертається)
      app.isAnimating = true;
      app.currentSectionIndex = 0;
      app.persistSection(); // зберегти позицію (секція 1 → hero іде в обхід goToSection)
      if (s1 && s1.isOurClients && s1.oc) s1.oc.prepare(); // приховати заголовки/прогрес для наступної появи
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      tl.tweenTo(labels[MAX - 1], { onComplete: () => { app.isAnimating = false; app.currentStep = MAX - 1; } });
      return true;
    }
    return false; // решта — стандартний стекінг
  };

  // 03d — Секція is-our-clients (ADR-013): 3 набори карток + прогрес-бар + скрамбл текстів.
  //   mode='desktop' — вертикальний свап наборів (3 стани).
  //   mode='tablet'  — те саме + ВНУТРІШНІЙ зсув карток на 6-карткових наборах (окремі кроки):
  //     зсув набору1 → набір2 → набір3+скрамбл → зсув набору3 → наступна секція.
  //   Спільні: прогрес (трек 15% / лінія 100%, по наборах), скрамбл H2/label на появі,
  //   перепис параграфів на наборі 3. Стан/методи — у section.oc; advance/goToSection делегують.
  app.buildOurClients = (mode) => {
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
    const cardsOf = (w) => [...w.querySelectorAll('.our-clients-card')];

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const SC = (chars, speed) => ({ chars: chars || 'upperCase', speed: speed || 1 });
    const NW = wraps.length;

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

    // — Скрамбл-утиліти (спільні) —
    const parseSegments = (e) => {
      const segs = [];
      e.childNodes.forEach((n) => {
        if (n.nodeType === 3) segs.push([n.textContent, '']);
        else if (n.nodeType === 1) segs.push([n.textContent, n.getAttribute('class') || '']);
      });
      return segs;
    };
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
    const morphParagraph = (p, segs) => {
      gsap.killTweensOf(p);
      gsap.to(p, {
        duration: 0.35, scrambleText: { text: '', ...SC('upperCase', 3) },
        onComplete: () => buildSegDOM(p, segs, false).forEach(([s, t]) => gsap.to(s, { duration: 0.6, scrambleText: { text: t, ...SC() } }))
      });
    };
    const morphTexts = (toNext) => paras.forEach((p, i) => morphParagraph(p, toNext ? TXT[i].next : TXT[i].orig));
    const setTexts = (toNext) => paras.forEach((p, i) => buildSegDOM(p, toNext ? TXT[i].next : TXT[i].orig, true));

    // Прогрес за індексом набору (0..NW-1)
    const setFill = (prog, animate) => {
      if (!fill) return;
      const w = ((prog + 1) / NW * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };
    // Заголовки (h2/label) скрамбляться ГЛОБАЛЬНО через 11-scramble.js за атрибутом
    //   [data-kulbit-scramble] (поява/вихід за видимістю у вьюпорті). Тут — лише картки,
    //   тексти карток (morphTexts/TXT) та прогрес-лінія.

    // Прогрес (заголовки керуються IO незалежно)
    // Прогрес-лінія: МИТТЄВО в 0 при підготовці (без видимого зворотного руху під час появи —
    //   спорожнення робить collapseCommon, коли секція реально сповзає геть). Фікс бага лінії.
    const prepareCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } }; // миттєво→0
    const enterCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } setFill(0, true); }; // 0→1/3
    const collapseCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } }; // плавно→0 разом зі сповзанням секції
    const showCommon = () => {}; // заголовки керуються IO; тут нічого

    section.isOurClients = true;

    if (mode === 'tablet' || mode === 'mobile') {
      // ТАБЛЕТ/МОБІЛКА: набори — вертикальні колонки; на наборах із зсувом — окремий крок «зсув карток».
      // Патерн зсувів per-набір (скільки карток зсунути): таблет [1,0,1], мобілка [2,1,2].
      const shiftN = (mode === 'mobile') ? [2, 1, 2] : [1, 0, 1];
      const cardStep = wraps.map((w) => {
        const c = cardsOf(w);
        return c.length > 1 ? (c[1].getBoundingClientRect().top - c[0].getBoundingClientRect().top) : 0;
      });
      // Генеруємо стадії з shiftN: поява → (зсув набору i, якщо shiftN[i]>0) → свап до наступного → ...
      const STAGES = (() => {
        const arr = [];
        const acc = new Array(NW).fill(0);
        arr.push({ cur: 0, shifts: acc.slice() });                                          // поява: набір 1
        for (let i = 0; i < NW; i++) {
          if ((shiftN[i] || 0) > 0) { acc[i] = shiftN[i]; arr.push({ cur: i, shifts: acc.slice() }); } // зсув набору i
          if (i < NW - 1) arr.push({ cur: i + 1, shifts: acc.slice() });                    // → наступний набір
        }
        return arr;
      })();
      const MAXST = STAGES.length - 1;
      const scrIdx = STAGES.findIndex((s) => s.cur === NW - 1); // поява останнього набору → перепис текстів
      const applyStage = (s, animate) => {
        const d = STAGES[s];
        wraps.forEach((w, i) => {
          const yp = i < d.cur ? -100 : (i > d.cur ? 100 : 0);
          const cy = -d.shifts[i] * cardStep[i];
          if (animate) { gsap.to(w, { yPercent: yp, duration: STEP, ease: EASE }); gsap.to(cardsOf(w), { y: cy, duration: STEP, ease: EASE }); }
          else { gsap.set(w, { yPercent: yp }); gsap.set(cardsOf(w), { y: cy }); }
        });
        setFill(d.cur, animate); // прогрес за індексом видимого набору
      };
      let stage = 0;
      applyStage(0, false); setTexts(false); prepareCommon(); // старт: прихований стан до появи
      section.oc = {
        get state() { return stage; },
        prepare() { stage = 0; applyStage(0, false); setTexts(false); prepareCommon(); },
        reset(toEnd) { stage = toEnd ? MAXST : 0; applyStage(stage, false); setTexts(stage >= scrIdx); showCommon(); },
        enter() { stage = 0; applyStage(0, false); enterCommon(); },
        collapse() { collapseCommon(); }, // секція сповзає геть → лінія плавно в 0
        dispose() {}, // заголовки скрамбляться глобально (11-scramble.js) — тут нічого прибирати
        step(dir) {
          const ns = Math.max(0, Math.min(MAXST, stage + dir));
          if (ns === stage) return false;
          const prev = stage; stage = ns;
          app.isAnimating = true;
          applyStage(stage, true);
          gsap.delayedCall(STEP, () => { app.isAnimating = false; });
          if (prev < scrIdx && stage >= scrIdx) morphTexts(true);   // перепис на появі останнього набору
          if (prev >= scrIdx && stage < scrIdx) morphTexts(false);  // назад → оригінал
          return true;
        }
      };
      console.log('[Kulbit-OC]', mode, 'готовий: наборів', NW, '| shiftN', shiftN.join(','), '| стадій', STAGES.length);
    } else {
      // ДЕСКТОП: простий вертикальний свап наборів (3 стани).
      const setCards = (s, animate) => wraps.forEach((w, i) => {
        const y = i < s ? -100 : (i > s ? 100 : 0);
        if (animate) gsap.to(w, { yPercent: y, duration: STEP, ease: EASE });
        else gsap.set(w, { yPercent: y });
      });
      let state = 0;
      setCards(0, false); setTexts(false); prepareCommon(); // старт: прихований стан до появи
      section.oc = {
        get state() { return state; },
        prepare() { state = 0; setCards(0, false); setTexts(false); prepareCommon(); },
        reset(toEnd) { state = toEnd ? NW - 1 : 0; setCards(state, false); setFill(state, false); setTexts(state === NW - 1); showCommon(); },
        enter() { state = 0; setCards(0, false); enterCommon(); },
        collapse() { collapseCommon(); }, // секція сповзає геть → лінія плавно в 0
        dispose() {}, // заголовки скрамбляться глобально (11-scramble.js) — тут нічого прибирати
        step(dir) {
          const ns = Math.max(0, Math.min(NW - 1, state + dir));
          if (ns === state) return false;
          const prev = state; state = ns;
          app.isAnimating = true;
          setCards(state, true);
          setFill(state, true);
          gsap.delayedCall(STEP, () => { app.isAnimating = false; });
          if (prev === 1 && state === 2) morphTexts(true);
          if (prev === 2 && state === 1) morphTexts(false);
          return true;
        }
      };
      console.log('[Kulbit-OC] desktop готовий, наборів:', NW);
    }
  };

  // 03c — Спец-секція is-projects (ADR-015 + ADR-016 re-approach): вертикальний свап відео + END-картинка.
  //   АДАПТИВНА через ВІКНО (WIN): desktop WIN=1 (одне відео на повний екран), tablet/mobile WIN=3
  //   (видно 3 картки). Елементи свапу = прямі діти [data-kulbit-project-group] (відео + остання
  //   [data-kulbit-project-end]). Видиме вікно [state .. state+WIN-1]: блоки height = slotH, решта 0;
  //   уся колонка зсунута по y на -(state*гэп) — гэп лишається між картками, але над вікном ховається
  //   за верхній край. maxState = total - WIN: останній стан — коли END став нижнім видимим → далі
  //   свайп = перехід на наступну секцію (advance). Свап: верхній блок вікна height→0 (стискається),
  //   знизу виростає наступний 0→slotH (розширюється), проміжні зсуваються вгору.
  //   Desktop тримає height у % (CSS картки реагують); tablet/mobile — px slotH + flex:none, бо там
  //   картки flex:1 1 0% (flex-grow ділив би висоту порівну й ігнорував height). Згорнуте відео →
  //   скидається на постер (пауза, час 0, контроли off). Прогрес-бар: (state+1)/(maxState+1).
  app.buildProjects = (mode) => {
    const group = document.querySelector('[data-kulbit-project-group]');
    if (!group) return;
    const section = app.sections.find((s) => s.el.contains(group));
    if (!section) { console.warn('[Kulbit-PV] секцію групи не знайдено'); return; }

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const isDesktop = mode === 'desktop';
    group.style.overflow = 'hidden';
    const gap = () => parseFloat(getComputedStyle(group).rowGap) || 0;

    const items = [...group.children].map((el) => {
      const isEnd   = el.matches('[data-kulbit-project-end]') || !!el.querySelector('[data-kulbit-project-end]');
      const isVideo = !isEnd && (el.matches('[data-kulbit-project-video]') || !!el.querySelector('[data-kulbit-project-video]'));
      const iframe  = el.querySelector('iframe');
      return {
        el, isVideo, isEnd,
        poster:   el.querySelector('[data-kulbit-poster]'),
        bigPlay:  el.querySelector('[data-kulbit-play]'),
        controls: el.querySelector('[data-kulbit-controls]'),
        player:   (isVideo && iframe && typeof Vimeo !== 'undefined') ? new Vimeo.Player(iframe) : null
      };
    });
    const els = items.map((r) => r.el);
    const total = items.length;
    if (total < 2) { console.warn('[Kulbit-PV] замало елементів свапу'); return; }

    // ВІКНО: desktop — 1 блок на повний екран; tablet/mobile — до 3 видимих блоків (захист min для малого total).
    const WIN = isDesktop ? 1 : Math.min(3, total);
    const maxState = total - WIN; // останній стан — коли END (остання дитина) став нижнім видимим
    // tablet/mobile: перебити flex:1 1 0% (інакше flex-grow ділить висоту порівну й ігнорує height)
    if (!isDesktop) gsap.set(els, { flex: 'none' });

    // slotH (лише tablet/mobile): доступна висота вьюпорта під групою / WIN.
    //   Простір над групою рахуємо ВІДНОСНО секції (group.top - section.top), а НЕ вьюпорта —
    //   щоб slotH не залежав від позиції секції на екрані (стекінг yPercent). Інакше при наїзді
    //   (секція ще під екраном) slotH виходив невірним → стрибок стану на завершенні появи.
    const slotHeight = () => {
      const wrapper = app.wrapper || document.querySelector('#smooth-wrapper');
      const wrapperH = wrapper ? wrapper.clientHeight : window.innerHeight;
      const gTop = group.getBoundingClientRect().top - section.el.getBoundingClientRect().top;
      const padB = parseFloat(getComputedStyle(section.el).paddingBottom) || 0; // section.el, НЕ section
      const availH = wrapperH - gTop - padB;
      return (availH - (WIN - 1) * gap()) / WIN;
    };

    // Прогрес-бар: трек 15% + дочірня лінія-заповнення 100% (.pv-fill), ширина (state+1)/(maxState+1)
    const bar = section.el.querySelector('.section-progresbar');
    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      fill = bar.querySelector('.pv-fill');
      if (!fill) { fill = document.createElement('div'); fill.className = 'pv-fill'; bar.appendChild(fill); }
      Object.assign(fill.style, { position: 'absolute', left: '0', top: '0', height: '100%', backgroundColor: '#fdfcfc' });
    }
    const setFill = (s, animate) => {
      if (!fill) return;
      const w = ((s + 1) / (maxState + 1) * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };
    const prepareFill  = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } };           // миттєво→0
    const enterFill    = () => { prepareFill(); setFill(0, true); };                                                  // 0→1/N (поява)
    const collapseFill = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } }; // плавно→0 (сповзання)

    // Скидання відео-елемента на початковий стан (постер + пауза + час 0 + контроли off)
    const resetItem = (rec) => {
      if (!rec.isVideo) return;
      if (rec.player)   { rec.player.pause(); rec.player.setCurrentTime(0); }
      if (rec.poster)   gsap.set(rec.poster,  { autoAlpha: 1 });
      if (rec.bigPlay)  gsap.set(rec.bigPlay, { autoAlpha: 1 });
      if (rec.controls) rec.controls.style.display = 'none';
    };
    const resetOthers = (active) => items.forEach((r, i) => { if (i !== active) resetItem(r); });

    // Зсув колонки: над вікном s блоків (0px) + s гэпів → зсув = -(s*гэп)
    const offsetFor = (s) => -s * gap();
    // Висоти блоків для стану s: вікно [s..s+WIN-1] видиме, решта згорнута.
    //   desktop — у % (картка на повний екран); tablet/mobile — px slotH.
    const setHeights = (s, animate) => {
      const sh = isDesktop ? null : slotHeight();
      items.forEach((r, i) => {
        const inWindow = i >= s && i < s + WIN;
        const h = isDesktop ? (inWindow ? '100%' : '0%') : (inWindow ? sh : 0);
        if (animate) gsap.to(r.el, { height: h, duration: STEP, ease: EASE });
        else gsap.set(r.el, { height: h });
      });
    };
    const moveColumn = (s, animate) => {
      if (animate) gsap.to(els, { y: offsetFor(s), duration: STEP, ease: EASE });
      else gsap.set(els, { y: offsetFor(s) });
    };
    // Дискретний стан без анімації
    const applyState = (s) => { setHeights(s, false); moveColumn(s, false); };

    let state = 0;
    applyState(0); resetOthers(0); prepareFill(); // старт: вікно з 0, решта на постері, лінія 0

    section.isProjects = true;
    section.pv = {
      get state() { return state; },
      prepare() { state = 0; applyState(0); resetOthers(0); prepareFill(); }, // наїзд: приховано (лінія 0)
      enter()   { state = 0; applyState(0); resetOthers(0); enterFill(); },   // повне накриття: лінія 0→1/N
      collapse() { collapseFill(); },                                          // секція сповзає геть → лінія плавно в 0
      reset(toEnd) { state = toEnd ? maxState : 0; applyState(state); setFill(state, false); resetOthers(state); }, // миттєвий стан
      // вихід із брейкпоінта: повертаємо натуральний лейаут (висоти/трансформ/flex зі step живуть
      //   поза matchMedia-контекстом, тож чистимо вручну — щоб інший брейкпоінт стартував чистим)
      dispose() { group.style.overflow = ''; gsap.set(els, { clearProps: 'height,transform,flex' }); if (fill) fill.remove(); },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false;        // межа вікна → advance викличе goToSection (перехід секції)
        const goingDown = ns > state;
        const out = goingDown ? items[state] : items[state + WIN - 1]; // блок, що виходить з вікна → на постер
        state = ns;
        app.isAnimating = true;
        resetItem(out);
        setHeights(ns, true);                  // верх схлоп / новий виріст / проміжні без змін
        moveColumn(ns, true);                  // колонка плавно зсувається
        setFill(ns, true);
        gsap.delayedCall(STEP, () => { app.isAnimating = false; });
        return true;
      }
    };
    console.log('[Kulbit-PV]', mode, 'готовий | елементів:', total, '| WIN', WIN, '| maxState', maxState, '| гэп', Math.round(gap()) + 'px');
  };

  // 03d — Спец-секція is-our-services: ГОРИЗОНТАЛЬНИЙ свап карток ([data-kulbit-hswipe-group]).
  //   Заголовки скрамбляться глобально (11-scramble.js). Стани:
  //   • 0 (поява): група виїжджає знизу + opacity; h2 написаний.
  //   • 1: h2 стирається скрамблом + його висота колапсує (flex сам підтягує картки вгору, геп = gap).
  //   • 2..total: горизонтальний свап карток (1 свайп = картка), зсув по x на (ширина + columnGap).
  app.buildHSwipe = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-our-services'));
    if (!section) return;
    const group = section.el.querySelector('[data-kulbit-hswipe-group]');
    if (!group) return;
    const cards = [...group.children];
    const total = cards.length;
    if (total < 2) { console.warn('[Kulbit-HS] замало карток'); return; }

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const RISE = 60; // px — група виїжджає знизу на появі
    const maxState = total; // 0 поява, 1 (h2 стерся + картки вгору), 2..total — свап карток
    const swapIndexOf = (s) => Math.max(0, s - 1); // картка у вікні: state 0,1 → 0; 2 → 1; ...
    const gap = () => parseFloat(getComputedStyle(group).columnGap) || 0;
    const cardW = () => cards[0].getBoundingClientRect().width;
    const shiftFor = (s) => -swapIndexOf(s) * (cardW() + gap()); // зсув групи по x за індексом картки

    // Крок 1 ховає заголовок скрамблом. Desktop/tablet: колапс висоти h2 (flex підтягує картки вгору,
    //   label лишається). MOBILE: ховаємо ВЕСЬ верх (progressbar + заголовок, autoAlpha) і підіймаємо
    //   картки рівно до padding-top секції — мало місця, картки мають іти на весь екран.
    const label = section.el.querySelector('.text-size-section-label');
    const h2 = section.el.querySelector('.text-size-section-h2');
    const isMobile = mode === 'mobile';
    const titleWrap = label ? label.closest('.flex-h-v-v') : null;
    const scrambleEls = (isMobile ? [label, h2] : [h2]).filter(Boolean); // що стирати скрамблом
    let origH2 = 0; // desktop/tablet: натуральна висота h2 (для колапсу/реверсу)
    let groupMT = 0; // desktop/tablet: значення margin-top:auto групи на state 0 (для реверсу)
    const measureTitle = () => { if (!isMobile && h2) origH2 = parseFloat(h2.style.height) || h2.offsetHeight; };
    const setTitle = (collapsed, animate) => {
      scrambleEls.forEach((el) => { const c = app.scrambles && app.scrambles.get(el); if (c) { collapsed ? c.out() : c.in(); } });
      if (isMobile) {
        // mobile: ховаємо progressbar + заголовок, картки підіймаємо до padding-top секції (bar — closure нижче)
        let upH = 0;
        if (collapsed) {
          const gr = group.getBoundingClientRect(), sr = section.el.getBoundingClientRect();
          const padTop = parseFloat(getComputedStyle(section.el).paddingTop) || 0;
          upH = gr.top - (sr.top + padTop);
        }
        const tops = [bar, titleWrap].filter(Boolean);
        const a = collapsed ? 0 : 1;
        if (animate) { gsap.to(tops, { autoAlpha: a, duration: STEP, ease: EASE }); gsap.to(group, { y: collapsed ? -upH : 0, duration: STEP, ease: EASE }); }
        else        { gsap.set(tops, { autoAlpha: a }); gsap.set(group, { y: collapsed ? -upH : 0 }); }
        return;
      }
      // desktop/tablet: колапс висоти h2 + прибрати margin-top:auto групи (інакше auto зʼїдає
      //   звільнене місце й картки не підіймаються). На реверсі повертаємо margin-top, потім — знову auto.
      if (!h2) return;
      const h = collapsed ? 0 : origH2;
      if (collapsed) groupMT = parseFloat(getComputedStyle(group).marginTop) || 0; // auto-значення на state 0
      if (animate) {
        gsap.to(h2, { height: h, duration: STEP, ease: EASE });
        if (collapsed) gsap.to(group, { marginTop: 0, duration: STEP, ease: EASE });
        else gsap.to(group, { marginTop: groupMT, duration: STEP, ease: EASE, onComplete: () => gsap.set(group, { marginTop: '' }) });
      } else {
        gsap.set(h2, { height: h });
        gsap.set(group, { marginTop: collapsed ? 0 : '' });
      }
    };

    // Прогрес-бар (як pv/oc): трек + дочірня лінія .hs-fill, ширина (state+1)/(maxState+1)
    const bar = section.el.querySelector('.section-progresbar');
    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.flexShrink = '0'; // інакше flex-v стискає бар (2px) до 0, бо контейнер переповнений
      bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      fill = bar.querySelector('.hs-fill');
      if (!fill) { fill = document.createElement('div'); fill.className = 'hs-fill'; bar.appendChild(fill); }
      Object.assign(fill.style, { position: 'absolute', left: '0', top: '0', height: '100%', backgroundColor: '#fdfcfc' });
    }
    const setFill = (s, animate) => {
      if (!fill) return;
      const w = ((s + 1) / (maxState + 1) * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };
    const prepareFill  = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } };
    const enterFill    = () => { prepareFill(); setFill(0, true); };
    const collapseFill = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } };

    const moveX     = (s, animate) => { const x = shiftFor(s); animate ? gsap.to(group, { x, duration: STEP, ease: EASE }) : gsap.set(group, { x }); };
    const showCards = () => gsap.fromTo(group, { y: RISE, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: STEP, ease: EASE });
    const hideCards = () => gsap.set(group, { autoAlpha: 0, y: RISE });

    let state = 0;
    group.style.willChange = 'transform';
    measureTitle();                                          // натуральна висота h2 (для реверсу кроку 1)
    moveX(0, false); setTitle(false, false); hideCards(); prepareFill(); // старт: картка 0, h2 написаний, приховано

    section.isHSwipe = true;
    section.hswipe = {
      get state() { return state; },
      prepare() { state = 0; moveX(0, false); setTitle(false, false); hideCards(); prepareFill(); }, // наїзд: приховано
      enter()   { state = 0; measureTitle(); moveX(0, false); setTitle(false, false); showCards(); enterFill(); }, // картки виїжджають; h2 пишеться глобально
      collapse() { collapseFill(); },
      reset(toEnd) { state = toEnd ? maxState : 0; moveX(state, false); setTitle(state >= 1, false); gsap.set(group, { autoAlpha: 1, y: 0 }); setFill(state, false); }, // origH2 НЕ перевимірюємо тут (h2 може бути сколапсований)
      dispose() { gsap.set(group, { clearProps: 'transform,opacity,visibility,willChange' }); if (h2) h2.style.height = ''; gsap.set([bar, titleWrap].filter(Boolean), { clearProps: 'opacity,visibility' }); if (fill) fill.remove(); },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false;        // межа → advance викличе goToSection
        const prev = state; state = ns;
        app.isAnimating = true;
        // заголовок ховаємо/показуємо ТІЛЬКИ на межі 0↔1 (не на кожному свапі — інакше mobile
        //   перевимірював би upH від уже піднятої групи й картки стрибали б)
        if (prev === 0 && ns >= 1) setTitle(true, true);        // крок 1: заголовок зникає, картки вгору
        else if (prev >= 1 && ns === 0) setTitle(false, true);  // назад: заголовок пишеться, картки вниз
        moveX(ns, true);                       // свап карток (за swapIndex)
        setFill(ns, true);
        gsap.delayedCall(STEP, () => { app.isAnimating = false; });
        return true;
      }
    };
    console.log('[Kulbit-HS]', mode, 'готовий | карток', total, '| maxState', maxState, '| h2H', Math.round(origH2), '| зсув', Math.round(cardW() + gap()) + 'px');
  };

  // 03g — Working Process (section.wp): REVEAL появи секції + STACK-CARDS, синхронізовані з SVG.
  //   REVEAL (enter): bg малюється -> крапки спалахують по черзі -> хвостик -> 3 сірі дуги -> label ->
  //     weeks -> синя+червона лінії; arrow1 промальовується БІЛОЮ суцільною поверх сірої + градієнт-тінь +
  //     білий наконечник; dot1/dot2 білі; cards-wrapper виїзд + формування стеку; is-second.
  //   КРОКИ (step): падіння активної + СИНХРОННА біла промальовка наступної стрілки (наступна картка
  //     стає в центр рівно коли стрілка домалювалась) + білішання відповідної крапки; реверс на крок назад.
  //   Вихід угору (collapse) -> reveal швидкий реверс (REV_SPEED). Desktop/tablet однаково; mobile спрощено.
  //   ADR-019 (картки) + SVG-ітерація. Пунктир (bg/сірі дуги) малюється clip-sweep (без розтягу);
  //   суцільні (blue/red/біла-клон) -- strokeDashoffset. Картки: z-index 75/50/25 фіксований по DOM.
  app.buildWorkingProcess = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-working-process'));
    if (!section) return;
    const sec = section.el;
    const cards = [...sec.querySelectorAll('.working-process-card')];
    if (cards.length < 2) { console.warn('[Kulbit-WP] замало карток'); return; }

    const NS = 'http://www.w3.org/2000/svg';
    const VERTICAL = mode !== 'desktop';
    const FALL_X = VERTICAL ? 0 : -50, FALL_Y = VERTICAL ? 100 : 50, FALL_ROT = -10;
    const STACK_X = VERTICAL ? 0 : 50, STACK_SS = VERTICAL ? 0.05 : 0.15, DARK = 0.4;
    const Z_VALUES = [75, 50, 25];
    const DUR_FALL = 0.9, DUR_SLIDE = 0.75, EASE = 'power1.inOut';
    const DUR_BG = 0.7, DUR_ARROW = 0.4, DUR_LABEL = 0.5, WK_STAG = 0.1, WK_DUR = 0.4;
    const DUR_BLUE = 0.7, DUR_RED = 0.45, DUR_AWHITE = 0.6, DUR_GRAD = 0.6, DUR_DOTCOL = 0.3, DUR_CARDSWRAP = 0.5;
    const WHITE_END_GAP = 5;   // px: біла лінія не доходить до кінчика наконечника
    const REV_SPEED = 5;       // у скільки разів швидша зворотна анімація при виході з секції
    const REVEAL_SPEED = 1.7;  // прискорення reveal-появи секції (перший етап) -- кроки карток не чіпає
    const WHITE10 = (getComputedStyle(sec).getPropertyValue('--colors--white-10') || '').trim() || '#fdfcfc';

    const maxState = cards.length - 1;
    const ovOf = (c) => c.querySelector('.kulbit-wp-overlay');
    const cardW = cards[0].getBoundingClientRect().width;

    // HTML-блоки появи
    const labelWrap   = sec.querySelector('.working-process-label-wrapper:not(.is-second)');
    const labelSecond = sec.querySelector('.working-process-label-wrapper.is-second');
    const weeks       = [...sec.querySelectorAll('.working-process-week')];
    const cardsWrapper = sec.querySelector('.working-process-cards-wrapper');

    // -- розкладка карток: i=0 relative; i>0 absolute центрована; overlay для затемнення стеку --
    cards.forEach((c, i) => {
      c.style.transformOrigin = '50% 50%';
      c.style.zIndex = String(Z_VALUES[i] || 25);
      if (i > 0) { c.style.position = 'absolute'; c.style.top = '0'; c.style.left = '50%'; c.style.marginLeft = (-cardW / 2) + 'px'; }
      let ov = ovOf(c);
      if (!ov) {
        ov = document.createElement('div'); ov.className = 'kulbit-wp-overlay';
        Object.assign(ov.style, { position: 'absolute', inset: '0', background: '#000', opacity: '0', borderRadius: getComputedStyle(c).borderRadius, pointerEvents: 'none', zIndex: '10' });
        c.appendChild(ov);
      }
    });

    // ===== активна SVG-діаграма (з лінією bg, видима на цьому брейкпоінті) =====
    const svgs = [...sec.querySelectorAll('svg')];
    const svg = svgs.find((s) => s.querySelector('[data-kulbit-svg-line]') && s.getBoundingClientRect().width > 1 && s.offsetParent !== null)
             || svgs.find((s) => s.querySelector('[data-kulbit-svg-line]') && s.getBoundingClientRect().width > 1) || null;

    const cleanSVG = () => {
      if (!svg) return;
      [...svg.querySelectorAll('clipPath')].forEach((cp) => { if (cp.id && cp.id.indexOf('wpClip') === 0) cp.remove(); });
      [...svg.querySelectorAll('[id^="wpW"]')].forEach((el) => el.remove());
    };
    cleanSVG(); // прибрати рудименти попередньої побудови

    let bg = null, blue = null, red = null, tail = null;
    let dotRings = [], arrowParts = [], arrowNums = [], greyStroke = null, greyHead = null;
    let W = 0, H = 0, bgRect = null, blueLen = 0, redLen = 0;
    const arrowRects = {}, whiteClones = {};
    const dotByN = (n) => dotRings.find((d) => d.getAttribute('data-kulbit-svg-dot') === String(n));
    const innerOf = (ring) => ring.nextElementSibling;
    const arrowGroup = (n) => {
      const parts = arrowParts.filter((el) => el.getAttribute('data-kulbit-svg-arrow') === String(n));
      return { line: parts.find((el) => el.getAttribute('data-kulbit-svg-part') === 'line'), head: parts.find((el) => el.getAttribute('data-kulbit-svg-part') === 'head'), fill: parts.find((el) => el.getAttribute('data-kulbit-svg-part') === 'fill') };
    };

    if (svg) {
      const vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(' ');
      W = parseFloat(vb[2]); H = parseFloat(vb[3]);
      const lines = [...svg.querySelectorAll('[data-kulbit-svg-line]')];
      const byLine = (v) => lines.find((el) => el.getAttribute('data-kulbit-svg-line') === v);
      bg = byLine('bg'); blue = byLine('blue'); red = byLine('red');
      tail = svg.querySelector('[data-kulbit-svg-tail]');
      dotRings = [...svg.querySelectorAll('[data-kulbit-svg-dot]')];
      arrowParts = [...svg.querySelectorAll('[data-kulbit-svg-arrow]')];
      arrowNums = [...new Set(arrowParts.map((el) => +el.getAttribute('data-kulbit-svg-arrow')))].sort((a, b) => a - b);

      // сірі кольори зчитуємо до наших сетів (для коректного реверсу fromTo)
      greyStroke = dotByN(1) ? getComputedStyle(dotByN(1)).stroke : null;
      greyHead = arrowGroup(1).head ? getComputedStyle(arrowGroup(1).head).fill : null;

      const makeClip = (id, x0) => {
        const cp = document.createElementNS(NS, 'clipPath'); cp.setAttribute('id', id); cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const rc = document.createElementNS(NS, 'rect'); rc.setAttribute('x', '0'); rc.setAttribute('y', '0'); rc.setAttribute('width', String(x0)); rc.setAttribute('height', String(H));
        cp.appendChild(rc); svg.appendChild(cp); return rc;
      };

      // стартово приховані svg-вузли
      arrowNums.forEach((n) => { const g = arrowGroup(n); if (g.fill) gsap.set(g.fill, { autoAlpha: 0 }); });
      if (tail) gsap.set(tail, { autoAlpha: 0 });
      dotRings.forEach((r) => { const inn = innerOf(r); [r, inn].filter(Boolean).forEach((el) => gsap.set(el, { autoAlpha: 0 })); });
      [blue, red].filter(Boolean).forEach((el) => gsap.set(el, { autoAlpha: 0 }));

      if (bg) { bgRect = makeClip('wpClipBg', 0); bg.setAttribute('clip-path', 'url(#wpClipBg)'); }

      arrowNums.forEach((n) => {
        const g = arrowGroup(n); if (!g.line) return;
        const bb = g.line.getBBox(); const hb = g.head ? g.head.getBBox() : null;
        const x0 = Math.floor(bb.x); const x1 = Math.ceil(Math.max(bb.x + bb.width, hb ? hb.x + hb.width : 0)) + 2;
        const rc = makeClip('wpClipArrow' + n, x0);
        g.line.setAttribute('clip-path', 'url(#wpClipArrow' + n + ')');
        if (g.head) g.head.setAttribute('clip-path', 'url(#wpClipArrow' + n + ')');
        gsap.set([g.line, g.head].filter(Boolean), { autoAlpha: 1 });
        arrowRects[n] = { rc, x0, x1 };
      });

      blueLen = blue ? blue.getTotalLength() : 0;
      redLen = red ? red.getTotalLength() : 0;

      // білі клони стрілок (arrow1 -- у reveal; решта -- на кроках); усі стартують недомальовані
      arrowNums.forEach((n) => {
        const g = arrowGroup(n); if (!g.line) return;
        const cl = g.line.cloneNode(true); cl.setAttribute('id', 'wpW' + n);
        cl.removeAttribute('data-kulbit-svg-arrow'); cl.removeAttribute('data-kulbit-svg-part'); cl.removeAttribute('clip-path');
        cl.style.stroke = WHITE10; cl.style.strokeWidth = '2'; cl.style.fill = 'none';
        g.line.parentNode.insertBefore(cl, g.line.nextSibling);
        const len = cl.getTotalLength(); gsap.set(cl, { strokeDasharray: len, strokeDashoffset: len });
        whiteClones[n] = { el: cl, len };
      });
    }

    // HTML стартово приховані; картки складені під основною
    const htmlEls = [labelWrap, labelSecond, ...weeks].filter(Boolean);
    if (htmlEls.length) gsap.set(htmlEls, { autoAlpha: 0, y: 40 });
    if (cardsWrapper) gsap.set(cardsWrapper, { autoAlpha: 0, y: 40 });

    let state = 0;

    // картки: вектор стану
    const cardVars = (i, s) => {
      const rank = i - s;
      if (rank < 0) return { card: { xPercent: FALL_X, yPercent: FALL_Y, scale: 1, rotation: FALL_ROT, opacity: 0 }, ov: { opacity: 0 } };
      if (rank === 0) return { card: { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }, ov: { opacity: 0 } };
      return { card: { xPercent: STACK_X * rank, yPercent: 0, scale: 1 - STACK_SS * rank, rotation: 0, opacity: 1 }, ov: { opacity: DARK * rank } };
    };
    const resetCardsToStart = () => { // reveal-старт: ПОВНИЙ reset усіх карток (вкл. yPercent) -> основна по центру, решта складена під нею
      cards.forEach((c) => { gsap.set(c, { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }); const ov = ovOf(c); if (ov) gsap.set(ov, { opacity: 0 }); });
    };
    resetCardsToStart();

    // крок-SVG (стрілки 2+, крапки 3+): миттєвий стан для state s
    const setStepSVGInstant = (s) => {
      arrowNums.forEach((n) => {
        if (n < 2) return; // arrow1 -- у reveal
        const drawn = n <= s + 1; const wc = whiteClones[n]; const g = arrowGroup(n);
        if (wc) gsap.set(wc.el, { strokeDashoffset: drawn ? WHITE_END_GAP : wc.len });
        if (g.fill) gsap.set(g.fill, { autoAlpha: drawn ? 1 : 0 });
        if (g.head && greyHead) gsap.set(g.head, { fill: drawn ? WHITE10 : greyHead });
      });
      dotRings.forEach((r) => { const n = +r.getAttribute('data-kulbit-svg-dot'); if (n < 3 || n >= dotRings.length || !greyStroke) return; gsap.set(r, { stroke: n <= s + 2 ? WHITE10 : greyStroke }); }); // остання крапка (Traditional-кінець) лишається сірою
    };
    setStepSVGInstant(0);

    // миттєвий ПОВНИЙ стан (cards + усе svg) для state s -- для reset (persistence/jump)
    const setStateInstant = (s) => {
      cards.forEach((c, i) => { const v = cardVars(i, s); gsap.set(c, v.card); const ov = ovOf(c); if (ov) gsap.set(ov, v.ov); });
      setStepSVGInstant(s);
      state = s;
    };

    // ===== REVEAL timeline (програється на enter, реверситься на collapse) =====
    const revealTL = gsap.timeline({ paused: true, onComplete: () => { app.isAnimating = false; } });
    (() => {
      const tl = revealTL;
      if (svg && bgRect) {
        tl.fromTo(bgRect, { attr: { width: 0 } }, { attr: { width: W }, duration: DUR_BG, ease: 'none' }, 0);
        dotRings.forEach((r) => { const at = (parseFloat(r.getAttribute('cx')) / W) * DUR_BG; const inn = innerOf(r); [r, inn].filter(Boolean).forEach((el) => tl.to(el, { autoAlpha: 1, duration: 0.25, ease: 'power1.out' }, at)); });
        if (tail) tl.to(tail, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, DUR_BG);
        arrowNums.forEach((n, i) => { const a = arrowRects[n]; if (a) tl.fromTo(a.rc, { attr: { width: a.x0 } }, { attr: { width: a.x1 }, duration: DUR_ARROW, ease: 'none' }, DUR_BG + i * DUR_ARROW); });
      }
      const afterArrows = svg ? DUR_BG + arrowNums.length * DUR_ARROW : 0.2;
      if (labelWrap) tl.to(labelWrap, { autoAlpha: 1, y: 0, duration: DUR_LABEL, ease: 'power2.out' }, afterArrows);
      const weeksStart = afterArrows + 0.25;
      if (weeks.length) tl.to(weeks, { autoAlpha: 1, y: 0, duration: WK_DUR, ease: 'power2.out', stagger: WK_STAG }, weeksStart);
      const weeksEnd = weeks.length ? (weeksStart + (weeks.length - 1) * WK_STAG + WK_DUR) : afterArrows;

      const phase = weeksEnd + 0.15, whiteEnd = phase + DUR_AWHITE, redStart = phase + DUR_BLUE, redEnd = redStart + DUR_RED;

      if (blue && blueLen) tl.fromTo(blue, { autoAlpha: 1, strokeDasharray: blueLen, strokeDashoffset: blueLen }, { strokeDashoffset: 0, duration: DUR_BLUE, ease: 'none' }, phase);
      if (red && redLen) tl.fromTo(red, { autoAlpha: 1, strokeDasharray: redLen, strokeDashoffset: redLen }, { strokeDashoffset: 0, duration: DUR_RED, ease: 'none' }, redStart);

      const a1 = arrowGroup(1);
      if (whiteClones[1]) tl.fromTo(whiteClones[1].el, { strokeDashoffset: whiteClones[1].len }, { strokeDashoffset: WHITE_END_GAP, duration: DUR_AWHITE, ease: 'power1.inOut' }, phase);
      if (a1.fill) tl.to(a1.fill, { autoAlpha: 1, duration: DUR_GRAD, ease: 'power1.out' }, phase);
      if (a1.head && greyHead) tl.fromTo(a1.head, { fill: greyHead }, { fill: WHITE10, duration: DUR_AWHITE * 0.55, ease: 'power1.inOut' }, phase + DUR_AWHITE * 0.45);
      if (dotByN(1) && greyStroke) tl.fromTo(dotByN(1), { stroke: greyStroke }, { stroke: WHITE10, duration: DUR_DOTCOL, ease: 'power1.out' }, phase);
      if (dotByN(2) && greyStroke) tl.fromTo(dotByN(2), { stroke: greyStroke }, { stroke: WHITE10, duration: DUR_DOTCOL, ease: 'power1.out' }, whiteEnd);

      if (cardsWrapper) tl.fromTo(cardsWrapper, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: DUR_CARDSWRAP, ease: 'power2.out' }, whiteEnd);
      const slideAt = whiteEnd + 0.3;
      cards.forEach((c, i) => { if (i === 0) return; const ov = ovOf(c); tl.fromTo(c, { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }, { xPercent: STACK_X * i, scale: 1 - STACK_SS * i, duration: DUR_SLIDE, ease: EASE }, slideAt); if (ov) tl.fromTo(ov, { opacity: 0 }, { opacity: DARK * i, duration: DUR_SLIDE, ease: EASE }, slideAt); });

      if (labelSecond) tl.to(labelSecond, { autoAlpha: 1, y: 0, duration: DUR_LABEL, ease: 'power2.out' }, redEnd);
    })();

    // ===== крок карток + синхронна SVG =====
    let stepTL = null;
    const stepTo = (target) => {
      target = Math.max(0, Math.min(maxState, target));
      if (target === state) return false;
      const dir = target > state ? 1 : -1;
      const hi = Math.max(state, target);
      const arrowN = hi + 1, dotN = hi + 2; // 0<->1: стрілка2/крапка3 ; 1<->2: стрілка3/крапка4
      if (stepTL) stepTL.kill();
      app.isAnimating = true;
      stepTL = gsap.timeline({ onComplete: () => { app.isAnimating = false; } });
      // картки
      cards.forEach((c, i) => {
        const v = cardVars(i, target); const ov = ovOf(c); const dur = (i - target) < 0 ? DUR_FALL : DUR_SLIDE;
        stepTL.to(c, Object.assign({ duration: dur, ease: EASE }, v.card), 0);
        if (ov) stepTL.to(ov, Object.assign({ duration: dur, ease: EASE }, v.ov), 0);
      });
      // SVG синхронно: стрілка домальовується разом із карткою-в-центр (DUR_SLIDE)
      if (svg) {
        const wc = whiteClones[arrowN], g = arrowGroup(arrowN), dotEl = (dotN < dotRings.length) ? dotByN(dotN) : null; // остання крапка лишається сірою
        if (dir > 0) {
          if (wc) stepTL.to(wc.el, { strokeDashoffset: WHITE_END_GAP, duration: DUR_SLIDE, ease: EASE }, 0);
          if (g.fill) stepTL.to(g.fill, { autoAlpha: 1, duration: DUR_SLIDE, ease: 'power1.out' }, 0);
          if (g.head && greyHead) stepTL.to(g.head, { fill: WHITE10, duration: DUR_SLIDE * 0.55, ease: EASE }, DUR_SLIDE * 0.45);
          if (dotEl && greyStroke) stepTL.to(dotEl, { stroke: WHITE10, duration: DUR_DOTCOL, ease: 'power1.out' }, DUR_SLIDE); // після стрілки
        } else {
          if (wc) stepTL.to(wc.el, { strokeDashoffset: wc.len, duration: DUR_SLIDE, ease: EASE }, 0);
          if (g.fill) stepTL.to(g.fill, { autoAlpha: 0, duration: DUR_SLIDE, ease: 'power1.out' }, 0);
          if (g.head && greyHead) stepTL.to(g.head, { fill: greyHead, duration: DUR_SLIDE * 0.55, ease: EASE }, 0);
          if (dotEl && greyStroke) stepTL.to(dotEl, { stroke: greyStroke, duration: DUR_DOTCOL, ease: 'power1.out' }, 0);
        }
      }
      state = target;
      return true;
    };

    section.isWP = true;
    section.wp = {
      get state() { return state; },
      prepare() {                                   // підхід згори -> стартовий прихований стан
        if (stepTL) stepTL.kill();
        state = 0;
        revealTL.timeScale(1).pause(0);
        resetCardsToStart();
        setStepSVGInstant(0);
      },
      enter() {                                     // повне накриття -> reveal вперед, прискорено (блокуємо скрол на час)
        app.isAnimating = true;
        revealTL.timeScale(REVEAL_SPEED).play();
      },
      collapse() { revealTL.timeScale(REV_SPEED).reverse(); },   // вихід угору -> швидкий реверс
      reset(toEnd) {                                // миттєвий стан (persistence/jump)
        if (stepTL) stepTL.kill();
        revealTL.timeScale(1).progress(1).pause(); // reveal-елементи у кінець
        setStateInstant(toEnd ? maxState : 0);     // cards + усе svg для стану
      },
      dispose() {                                   // вихід з брейкпоінта -- повне очищення
        revealTL.kill(); if (stepTL) stepTL.kill();
        cleanSVG();
        [bg, ...arrowParts].forEach((el) => el && el.removeAttribute('clip-path'));
        const svgEls = [bg, blue, red, tail, ...arrowParts, ...dotRings];
        dotRings.forEach((r) => { const inn = innerOf(r); if (inn) svgEls.push(inn); });
        [...svgEls, labelWrap, labelSecond, ...weeks, cardsWrapper].filter(Boolean).forEach((el) => gsap.set(el, { clearProps: 'all' }));
        cards.forEach((c) => {
          gsap.set(c, { clearProps: 'all' });
          c.style.position = ''; c.style.top = ''; c.style.left = ''; c.style.marginLeft = ''; c.style.zIndex = ''; c.style.transformOrigin = '';
          const ov = ovOf(c); if (ov) ov.remove();
        });
      },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false; // межа -> advance викличе goToSection
        return stepTo(ns);
      }
    };
    console.log('[Kulbit-WP]', mode, 'готовий | карток', cards.length, '| maxState', maxState, '| svg', !!svg, '| стрілок', arrowNums.length, '| режим', VERTICAL ? 'vertical' : 'horizontal');
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

  // 03h — Footer-scroll (section.ft, ADR-020): на вузьких девайсах футер ВИЩИЙ за екран, а
  //   нативно скролити не можна (Observer глушить скрол через preventDefault). Тож зсуваємо
  //   контент ПОКРОКОВО трансформом — як wp/hswipe: жест донизу зсуває внутрішній контейнер
  //   угору (відкриває низ), на верхній межі step повертає false → керування йде рушію
  //   (goToSection попередньої секції). Монтуємо ЛИШЕ якщо контент реально переповнює видиму
  //   висоту; інакше футер лишається штатним (fill-100vh). Видиму висоту беремо з #smooth-wrapper
  //   (НЕ 100vh: на iOS адресний бар робить 100vh > видимої), тож скрол точний на будь-якому девайсі.
  const FT_STEP_RATIO = 0.85; // частка видимої висоти за один жест (тунабельно)
  app.buildFooterScroll = (mode) => {
    const footer = app.sections.find((s) => s.isFooter);
    if (!footer) return;
    const container = footer.el.querySelector('.container.is-footer');
    if (!container) { console.warn('[Kulbit-Footer] немає .container.is-footer'); return; }

    const visH = () => (app.wrapper ? app.wrapper.clientHeight : window.innerHeight);

    // Вихідні стилі (повертаємо у dispose при зміні брейкпоінта)
    const savedContainer = container.getAttribute('style') || '';
    const savedFooterH = footer.el.style.height;          // що поставив setupStacking ('100vh')
    const savedFooterOverflow = footer.el.style.overflow;

    // 01 — Контент натуральної висоти + кліп-вікно = видима зона → міряємо переповнення
    container.style.height = 'auto';
    container.style.justifyContent = 'flex-start';
    footer.el.style.height = visH() + 'px';
    const maxShift0 = Math.max(0, footer.el.scrollHeight - footer.el.clientHeight);

    // 02 — Не переповнює → повертаємо штатний fill-лейаут, скрол не монтуємо
    if (maxShift0 <= 4) {
      container.setAttribute('style', savedContainer);
      footer.el.style.height = savedFooterH;
      console.log('[Kulbit-Footer] ' + mode + ': футер влазить — скрол не потрібен');
      return;
    }

    // 03 — Переповнює → лишаємо кліп-вікно (видима висота), монтуємо покроковий скрол
    container.style.willChange = 'transform';
    footer.el.style.overflow = 'hidden';

    let pos = 0, maxShift = 0, stepPx = 0, onVV = null;

    const recompute = () => {
      footer.el.style.height = visH() + 'px';
      maxShift = Math.max(0, footer.el.scrollHeight - footer.el.clientHeight);
      stepPx = Math.round(visH() * FT_STEP_RATIO);
      pos = Math.min(pos, maxShift);
      gsap.set(container, { y: -pos });
    };
    recompute();

    footer.ft = {
      // Один жест = один крок зсуву. true → жест оброблено; false → межа, керування рушію.
      step(dir) {
        if (maxShift <= 0) return false;             // влізло (напр. після повороту) → звичайна секція
        if (dir > 0) {
          if (pos >= maxShift) return true;          // вже внизу → зʼїдаємо жест, лишаємось у футері
          pos = Math.min(pos + stepPx, maxShift);
        } else {
          if (pos <= 0) return false;                // вгорі → віддаємо керування → goToSection попередньої
          pos = Math.max(pos - stepPx, 0);
        }
        app.isAnimating = true;
        gsap.to(container, {
          y: -pos, duration: app.config.stepDuration, ease: app.config.ease,
          onComplete: () => { app.isAnimating = false; }
        });
        console.log('[Kulbit-Footer] крок dir', dir, '→ pos', pos, '/', maxShift);
        return true;
      },
      reset() { pos = 0; recompute(); gsap.set(container, { y: 0 }); }, // вхід у футер — завжди з верху
      recompute,
      dispose() {
        if (onVV) {
          if (window.visualViewport) window.visualViewport.removeEventListener('resize', onVV);
          window.removeEventListener('resize', onVV);
        }
        gsap.set(container, { y: 0 });
        container.setAttribute('style', savedContainer);
        footer.el.style.height = savedFooterH;
        footer.el.style.overflow = savedFooterOverflow;
      }
    };

    // 04 — Перерахунок при зміні видимої висоти (адресний бар iOS / ресайз) — як hero-відео
    onVV = () => { if (footer.ft) footer.ft.recompute(); };
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onVV);
    window.addEventListener('resize', onVV);

    console.log('[Kulbit-Footer] ' + mode + ': скрол змонтовано — maxShift', maxShift, 'крок', stepPx);
  };

  // 03i — Traditional Production (section.tp, ADR-021, поки DESKTOP): радар-порівняння
  //   Traditional(red)/KULBIT(blue) — два пʼятикутники (накладені) + дві групи по 4 картки.
  //   Червона фаза (1-4): поява left/right (+ авто крок1) → картки виїжджають, зʼявляються крапки,
  //     card-progres наповнюється до % (data-kulbit-progress); крок4 — картка+лінія+градієнт одночасно.
  //   Перехід (4→5): червоні картки 4>3>2>1 каскадом зникають (display:none → 5-та до верху),
  //     червоний svg гасне (градієнт геть + крапки[крім центру]/лінія → black-30).
  //   Синя фаза (5-8): дзеркало червоної на синьому svg (на старті синій ВЗАГАЛІ прихований).
  //   Пунктир «малюється» клон-маскою + dashoffset (як біла стрілка WP). Tablet/mobile — наступним кроком.
  app.buildTraditional = (mode) => {
    if (mode !== 'desktop') return; // поки фіксуємо лише desktop
    const section = app.sections.find((s) => s.el.classList.contains('is-traditional-production'));
    if (!section) return;
    const el = section.el;

    const left = el.querySelector('.traditional-production-left');
    const right = el.querySelector('.traditional-production-right');
    const bar = el.querySelector('.section-progresbar');
    const allCards = [...el.querySelectorAll('.traditional-production-card')];
    const cardDots = [['1'], ['2'], ['3-1', '3-2'], ['4']];   // локальна картка i → крапка(и)
    const DEMO_PCT = [40, 65, 55, 85];                         // запасні %, поки нема data-kulbit-progress

    const STEP = app.config.stepDuration, SCROLL = app.config.scrollDuration, EASE = app.config.ease;
    const LINE_TOTAL = 0.85, CAS = STEP * 0.5, CAS_STAG = 0.12, maxState = 8;
    let state = 0;

    const cssVar = (n, fb) => { const v = getComputedStyle(el).getPropertyValue(n).trim(); return v || fb; };
    const WHITE = cssVar('--colors--white', 'white');
    const BLACK30 = cssVar('--colors--black-30', '#252525');

    // Маска «малювання» пунктирного сегмента (солід-клон + dashoffset)
    const NS = 'http://www.w3.org/2000/svg';
    const ensureMask = (svg, edge, idx, key) => {
      if (edge.__tpMask) return edge.__tpMask;
      let defs = svg.querySelector('defs');
      if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs); }
      const vb = (svg.getAttribute('viewBox') || '0 0 489 412').split(/\s+/).map(Number);
      const mask = document.createElementNS(NS, 'mask');
      mask.id = 'tp-' + key + '-mask-' + idx;
      mask.setAttribute('maskUnits', 'userSpaceOnUse');
      mask.setAttribute('x', vb[0]); mask.setAttribute('y', vb[1]);
      mask.setAttribute('width', vb[2]); mask.setAttribute('height', vb[3]);
      const clone = edge.cloneNode(false);
      [...clone.attributes].forEach((a) => { if (a.name.indexOf('data-') === 0) clone.removeAttribute(a.name); });
      clone.setAttribute('stroke', 'white'); clone.setAttribute('stroke-width', '6'); clone.setAttribute('fill', 'none');
      const L = edge.getTotalLength();
      clone.setAttribute('stroke-dasharray', L); clone.setAttribute('stroke-dashoffset', L);
      mask.appendChild(clone); defs.appendChild(mask);
      edge.setAttribute('mask', 'url(#tp-' + key + '-mask-' + idx + ')');
      edge.__tpMask = { clone, L };
      return edge.__tpMask;
    };

    // Збірка групи (svg + 4 картки)
    const injectFill = (p) => {
      p.style.position = 'relative'; p.style.overflow = 'hidden';
      let f = p.querySelector('.tp-card-fill');
      if (!f) { f = document.createElement('div'); f.className = 'tp-card-fill'; p.appendChild(f); }
      Object.assign(f.style, { position: 'absolute', left: '0', top: '0', height: '100%', width: '0%', backgroundColor: 'var(--colors--white-10)' });
      return f;
    };
    const buildGroup = (sel, cardEls, key) => {
      const svg = el.querySelector(sel);
      if (!svg) { console.warn('[Kulbit-TP] немає svg:', sel); return null; }
      const dot = (n) => svg.querySelector('[data-kulbit-svg-dot="' + n + '"]');
      const center = svg.querySelector('[data-kulbit-svg-center]');
      const edges = [1, 2, 3, 4, 5].map((n) => svg.querySelector('[data-kulbit-svg-edge="' + n + '"]'));
      const gradFill = svg.querySelector('[data-kulbit-svg-fill]');
      edges.forEach((e, i) => e && ensureMask(svg, e, i, key));
      const totalLen = edges.reduce((s, e) => s + (e && e.__tpMask ? e.__tpMask.L : 0), 0) || 1;
      const progFills = cardEls.map((c) => { const p = c.querySelector('.traditional-product-card-progres'); return p ? injectFill(p) : null; });
      return { svg, key, cards: cardEls, dot, center, edges, gradFill, totalLen, progFills };
    };
    const red = buildGroup('.traditional-production-svg:not(.is-blue) svg', allCards.slice(0, 4), 'red');
    const blue = buildGroup('.traditional-production-svg.is-blue svg', allCards.slice(4, 8), 'blue');
    if (!red || !blue) { console.warn('[Kulbit-TP] немає red/blue групи — пропускаємо'); return; }

    // Прогрес-бар секції (трек + дочірня лінія, як oc/hswipe)
    let secFill = null;
    if (bar) {
      bar.style.position = 'relative'; bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      secFill = bar.querySelector('.tp-fill') || document.createElement('div');
      if (!secFill.parentNode) { secFill.className = 'tp-fill'; bar.appendChild(secFill); }
      Object.assign(secFill.style, { position: 'absolute', left: '0', top: '0', height: '100%', width: '0%', backgroundColor: 'var(--colors--white-10)' });
    }

    const pctOf = (g, li) => {
      const p = g.cards[li] && g.cards[li].querySelector('.traditional-product-card-progres');
      const a = p && p.getAttribute('data-kulbit-progress');
      const n = a != null ? parseFloat(a) : NaN;
      return isNaN(n) ? DEMO_PCT[li] : Math.max(0, Math.min(100, n));
    };
    const edgeDur = (g, L) => Math.max(0.04, (L / g.totalLen) * LINE_TOTAL);
    const setSec = (tl, s, at) => { if (secFill) tl.to(secFill, { width: (s / maxState * 100) + '%', duration: STEP, ease: EASE }, at); };

    // Будівельні блоки таймлайну (gState = глобальний стан для прогрес-бара)
    const addCard = (tl, g, li, gState) => {
      const at = tl.duration();
      tl.fromTo(g.cards[li], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: STEP, ease: EASE }, at);
      cardDots[li].forEach((n) => { const d = g.dot(n); if (d) tl.to(d, { autoAlpha: 1, duration: STEP, ease: EASE }, at); });
      if (g.progFills[li]) tl.to(g.progFills[li], { width: pctOf(g, li) + '%', duration: STEP, ease: EASE }, at); // наповнення з початку появи
      setSec(tl, gState, at);
    };
    const addFinal = (tl, g, gState) => { // картка 4 + лінія ОДНОЧАСНО → градієнт
      const li = 3, at = tl.duration();
      tl.fromTo(g.cards[li], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: STEP, ease: EASE }, at);
      cardDots[li].forEach((n) => { const d = g.dot(n); if (d) tl.to(d, { autoAlpha: 1, duration: STEP, ease: EASE }, at); });
      if (g.progFills[li]) tl.to(g.progFills[li], { width: pctOf(g, li) + '%', duration: STEP, ease: EASE }, at);
      setSec(tl, gState, at);
      let lat = at;
      g.edges.forEach((e, idx) => { const m = ensureMask(g.svg, e, idx, g.key); const dur = edgeDur(g, m.L); tl.fromTo(m.clone, { attr: { 'stroke-dashoffset': m.L } }, { attr: { 'stroke-dashoffset': 0 }, duration: dur, ease: 'none' }, lat); lat += dur; });
      tl.to(g.gradFill, { autoAlpha: 1, duration: STEP, ease: EASE }, lat);
    };
    const removeCard = (tl, g, li, gAfter) => {
      const at = tl.duration();
      if (g.progFills[li]) tl.to(g.progFills[li], { width: '0%', duration: STEP * 0.5, ease: EASE }, at);
      cardDots[li].forEach((n) => { const d = g.dot(n); if (d) tl.to(d, { autoAlpha: 0, duration: STEP * 0.6, ease: EASE }, at); });
      tl.to(g.cards[li], { autoAlpha: 0, y: 40, duration: STEP, ease: EASE }, at);
      setSec(tl, gAfter, at);
    };
    const removeFinal = (tl, g, gAfter) => { // картка 4 + лінія ОДНОЧАСНО геть
      const li = 3, at0 = tl.duration();
      tl.to(g.gradFill, { autoAlpha: 0, duration: STEP * 0.4, ease: EASE }, at0);
      let lat = at0;
      g.edges.slice().reverse().forEach((e) => { const m = e.__tpMask; if (!m) return; const dur = edgeDur(g, m.L); tl.to(m.clone, { attr: { 'stroke-dashoffset': m.L }, duration: dur, ease: 'none' }, lat); lat += dur; });
      if (g.progFills[li]) tl.to(g.progFills[li], { width: '0%', duration: STEP * 0.5, ease: EASE }, at0);
      cardDots[li].forEach((n) => { const d = g.dot(n); if (d) tl.to(d, { autoAlpha: 0, duration: STEP * 0.6, ease: EASE }, at0); });
      tl.to(g.cards[li], { autoAlpha: 0, y: 40, duration: STEP, ease: EASE }, at0);
      setSec(tl, gAfter, at0);
    };

    // Кожна фаза тримає в ПОТОЦІ лише свої 4 картки → перша картка фази притиснута до верху
    const setPhaseDisplay = (bluePhase) => {
      red.cards.forEach((c) => { c.style.display = bluePhase ? 'none' : ''; });
      blue.cards.forEach((c) => { c.style.display = bluePhase ? '' : 'none'; });
    };
    const tintRed = (tl, color, at) => { // кольори червоного svg (крапки[крім центру] + лінія)
      ['1', '2', '3-1', '3-2', '4'].forEach((n) => { const d = red.dot(n); if (d) tl.to(d, { fill: color, duration: STEP, ease: EASE }, at); });
      red.edges.forEach((e) => tl.to(e, { stroke: color, duration: STEP, ease: EASE }, at));
    };
    const transitionToBlue = (tl) => { // стан 4→5
      const at0 = tl.duration();
      [3, 2, 1, 0].forEach((li, k) => tl.to(red.cards[li], { autoAlpha: 0, y: 40, duration: CAS, ease: EASE }, at0 + k * CAS_STAG)); // 4>3>2>1 вниз
      tl.to(red.gradFill, { autoAlpha: 0, duration: STEP * 0.5, ease: EASE }, at0);
      tintRed(tl, BLACK30, at0);
      const afterCascade = at0 + CAS_STAG * 3 + CAS;
      tl.call(() => setPhaseDisplay(true), null, afterCascade); // червоні display:none, сині в потік → картка 5 до верху
      if (blue.center) tl.to(blue.center, { autoAlpha: 1, duration: STEP * 0.5, ease: EASE }, afterCascade);
    };
    const reverseTransition = (tl) => { // стан 5→4
      const at0 = tl.duration();
      if (blue.progFills[0]) tl.to(blue.progFills[0], { width: '0%', duration: STEP * 0.4, ease: EASE }, at0);
      const bd = blue.dot('1'); if (bd) tl.to(bd, { autoAlpha: 0, duration: STEP * 0.5, ease: EASE }, at0);
      tl.to(blue.cards[0], { autoAlpha: 0, y: 40, duration: CAS, ease: EASE }, at0);
      if (blue.center) tl.to(blue.center, { autoAlpha: 0, duration: STEP * 0.4, ease: EASE }, at0);
      const restore = at0 + CAS;
      tl.call(() => setPhaseDisplay(false), null, restore); // червоні назад у потік, сині display:none
      tl.to(red.gradFill, { autoAlpha: 1, duration: STEP, ease: EASE }, restore);
      tintRed(tl, WHITE, restore);
      [0, 1, 2, 3].forEach((li, k) => tl.to(red.cards[li], { autoAlpha: 1, y: 0, duration: CAS, ease: EASE }, restore + k * CAS_STAG));
      setSec(tl, 4, at0);
    };

    const forwardTo = (tl, s) => {
      if (s <= 3) addCard(tl, red, s - 1, s);
      else if (s === 4) addFinal(tl, red, s);
      else if (s === 5) { transitionToBlue(tl); addCard(tl, blue, 0, s); }
      else if (s <= 7) addCard(tl, blue, s - 5, s);
      else if (s === 8) addFinal(tl, blue, s);
    };
    const backFrom = (tl, s) => { // зі стану s у s-1
      if (s === 8) removeFinal(tl, blue, s - 1);
      else if (s >= 6) removeCard(tl, blue, s - 5, s - 1);
      else if (s === 5) reverseTransition(tl);
      else if (s === 4) removeFinal(tl, red, s - 1);
      else if (s >= 2) removeCard(tl, red, s - 1, s - 1);
    };

    // Миттєвий стан (persistence/jump): старт або кінець
    const showStart = () => {
      api.prepare();
      gsap.set([left, right], { autoAlpha: 1, y: 0 });
      gsap.set(red.cards[0], { autoAlpha: 1, y: 0 });
      const d = red.dot('1'); if (d) gsap.set(d, { autoAlpha: 1 });
      if (red.progFills[0]) gsap.set(red.progFills[0], { width: pctOf(red, 0) + '%' });
      if (secFill) gsap.set(secFill, { width: (1 / maxState * 100) + '%' });
      state = 1;
    };
    const showEnd = () => {
      api.prepare();
      gsap.set([left, right], { autoAlpha: 1, y: 0 });
      setPhaseDisplay(true); // синя фаза: червоні картки display:none
      ['1', '2', '3-1', '3-2', '4'].forEach((n) => { const d = red.dot(n); if (d) gsap.set(d, { autoAlpha: 1, fill: BLACK30 }); });
      red.edges.forEach((e, i) => { const m = ensureMask(red.svg, e, i, 'red'); gsap.set(m.clone, { attr: { 'stroke-dashoffset': 0 } }); gsap.set(e, { stroke: BLACK30 }); });
      if (blue.center) gsap.set(blue.center, { autoAlpha: 1 });
      ['1', '2', '3-1', '3-2', '4'].forEach((n) => { const d = blue.dot(n); if (d) gsap.set(d, { autoAlpha: 1 }); });
      blue.edges.forEach((e, i) => { const m = ensureMask(blue.svg, e, i, 'blue'); gsap.set(m.clone, { attr: { 'stroke-dashoffset': 0 } }); });
      if (blue.gradFill) gsap.set(blue.gradFill, { autoAlpha: 1 });
      blue.cards.forEach((c, li) => { gsap.set(c, { autoAlpha: 1, y: 0 }); if (blue.progFills[li]) gsap.set(blue.progFills[li], { width: pctOf(blue, li) + '%' }); });
      if (secFill) gsap.set(secFill, { width: '100%' });
      state = maxState;
    };

    const newTL = () => { app.isAnimating = true; return gsap.timeline({ onComplete: () => { app.isAnimating = false; } }); };

    const api = {
      prepare() {
        gsap.set([left, right], { autoAlpha: 0, y: 50 });
        gsap.set(allCards, { autoAlpha: 0, y: 40 });
        setPhaseDisplay(false);                                 // старт — червона фаза (сині картки display:none)
        if (red.center) gsap.set(red.center, { autoAlpha: 1 }); // червоний центр — завжди видимий
        ['1', '2', '3-1', '3-2', '4'].forEach((n) => { const d = red.dot(n); if (d) gsap.set(d, { autoAlpha: 0, fill: WHITE }); });
        red.edges.forEach((e, i) => { const m = ensureMask(red.svg, e, i, 'red'); gsap.set(m.clone, { attr: { 'stroke-dashoffset': m.L } }); gsap.set(e, { stroke: WHITE }); });
        if (red.gradFill) gsap.set(red.gradFill, { autoAlpha: 0 });
        if (blue.center) gsap.set(blue.center, { autoAlpha: 0 }); // синій — ВЗАГАЛІ прихований
        ['1', '2', '3-1', '3-2', '4'].forEach((n) => { const d = blue.dot(n); if (d) gsap.set(d, { autoAlpha: 0 }); });
        blue.edges.forEach((e, i) => { const m = ensureMask(blue.svg, e, i, 'blue'); gsap.set(m.clone, { attr: { 'stroke-dashoffset': m.L } }); });
        if (blue.gradFill) gsap.set(blue.gradFill, { autoAlpha: 0 });
        red.progFills.concat(blue.progFills).forEach((f) => { if (f) gsap.set(f, { width: '0%' }); });
        if (secFill) gsap.set(secFill, { width: '0%' });
        state = 0;
      },
      enter() {
        const tl = newTL();
        tl.to(left, { autoAlpha: 1, y: 0, duration: SCROLL, ease: EASE }, 0);
        tl.to(right, { autoAlpha: 1, y: 0, duration: SCROLL, ease: EASE }, 0.1);
        addCard(tl, red, 0, 1);                                 // авто перший етап у кінці появи
        state = 1;
        console.log('[Kulbit-TP] enter → поява left/right + авто крок 1');
      },
      step(dir) {
        if (dir > 0) {
          if (state >= maxState) return false;                  // межа → наступна секція
          state++; forwardTo(newTL(), state);
          console.log('[Kulbit-TP] →', state); return true;
        }
        if (state <= 1) return false;                           // стан 1 = перша картка → вгору = попередня секція
        const s = state; state--; backFrom(newTL(), s);
        console.log('[Kulbit-TP] ←', state); return true;
      },
      reset(toEnd) { if (toEnd) showEnd(); else showStart(); },
      dispose() {
        allCards.forEach((c) => { c.style.display = ''; });
        [secFill].concat(red.progFills, blue.progFills).forEach((f) => { if (f && f.parentNode) f.parentNode.removeChild(f); });
        [red, blue].forEach((g) => g.edges.forEach((e) => {
          if (!e) return;
          e.removeAttribute('mask');
          if (e.__tpMask && e.__tpMask.clone && e.__tpMask.clone.parentNode) {
            const mk = e.__tpMask.clone.parentNode; if (mk.parentNode) mk.parentNode.removeChild(mk);
          }
          delete e.__tpMask;
        }));
        if (bar) { bar.style.backgroundColor = ''; bar.style.position = ''; }
      }
    };

    section.tp = api;
    section.isTraditional = true;
    api.prepare();
    console.log('[Kulbit-TP] desktop: секцію змонтовано (maxState ' + maxState + ')');
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
    if (clamped > 0) app.passHero(); // йдемо на НЕ-hero → хедер зникає (hero-таймлайн у кінець)

    // Стан кроків/таймлайну нової секції
    if ((target.isOurClients && target.oc) || (target.isProjects && target.pv) || (target.isHSwipe && target.hswipe) || (target.isWP && target.wp) || (target.isTraditional && target.tp)) {
      app.currentStep = 0; // власний стан — у target.oc / target.pv / target.hswipe / target.wp
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
      app.persistSection();
      app.applyStackingPositions();
      if (target.isOurClients && target.oc) target.oc.reset(dir < 0); // миттєвий стан секції
      if (target.isProjects && target.pv) target.pv.reset(dir < 0);   // миттєвий стан свапу відео
      if (target.isHSwipe && target.hswipe) target.hswipe.reset(dir < 0); // миттєвий стан горизонт. свапу
      if (target.isWP && target.wp) target.wp.reset(dir < 0);         // миттєвий стан wp-карток
      if (target.isFooter && target.ft) target.ft.reset();            // футер — завжди з верху
      if (target.isTraditional && target.tp) target.tp.reset(dir < 0); // traditional: старт (вниз) / кінець (вгору)
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      return;
    }

    app.isAnimating = true;
    app.currentSectionIndex = clamped;
    app.persistSection();
    // Відео нової поточної секції — показуємо ОДРАЗУ (грає, поки секція наповзає/відкривається).
    if (app.showCurrentVideo) app.showCurrentVideo();
    const finish = () => {
      app.isAnimating = false;
      // Відео накритих секцій — пауза САМЕ КОЛИ перехід завершився (секція торкнулась верху екрана),
      // а не на початку наповзання. На таблеті/мобілці пауза вже в onComplete кроку 3 (tabletHeroStep).
      if (app.hideOtherVideos) app.hideOtherVideos();
    };
    if (dir > 0) {
      // вниз: проміжні секції (між поточною й ціллю) миттєво в стек — плавний СТРИБОК через кілька
      for (let i = prev + 1; i < clamped; i++) gsap.set(app.sections[i].el, { yPercent: 0 });
      // ціль наповзає знизу поверх поточної
      if (target.isOurClients && target.oc) target.oc.prepare(); // під час наїзду — приховано (прогрес/заголовки)
      if (target.isProjects && target.pv) target.pv.prepare();   // is-projects: приховано до появи (лінія 0)
      if (target.isHSwipe && target.hswipe) target.hswipe.prepare(); // is-our-services: картки приховано
      if (target.isWP && target.wp) target.wp.prepare();            // is-working-process: миттєво стартовий стек
      if (target.isFooter && target.ft) target.ft.reset();          // футер наповзає з верху (pos 0)
      if (target.isTraditional && target.tp) target.tp.prepare();   // traditional: прихований стан до появи
      gsap.to(target.el, {
        yPercent: 0,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => {
          finish();
          if (target.isOurClients && target.oc) target.oc.enter(); // на повному накритті — поява
          if (target.isProjects && target.pv) target.pv.enter();
          if (target.isHSwipe && target.hswipe) target.hswipe.enter(); // is-our-services: картки виїжджають
          if (target.isWP && target.wp) target.wp.enter();          // is-working-process: підтвердити стек
          if (target.isTraditional && target.tp) target.tp.enter(); // traditional: поява left/right + авто крок 1
        }
      });
    } else {
      // вгору: проміжні секції (між ціллю й поточною) миттєво під екран — плавний СТРИБОК угору
      for (let i = clamped + 1; i < prev; i++) gsap.set(app.sections[i].el, { yPercent: 100 });
      // поточна сповзає вниз, відкриваючи ціль
      if (target.isOurClients && target.oc) target.oc.reset(true); // секцію відкривають на набір 3 (кінець)
      if (target.isProjects && target.pv) target.pv.reset(true);   // is-projects: відкривають на END-картинці
      if (target.isHSwipe && target.hswipe) target.hswipe.reset(true); // is-our-services: відкривають на останній картці
      if (target.isWP && target.wp) target.wp.reset(true);            // is-working-process: відкривають на останній картці
      if (target.isTraditional && target.tp) target.tp.reset(true);   // traditional: відкривають на кінці (синя фаза)
      // Секція, що сповзає геть → її прогрес-лінія плавно згортається разом із нею (фікс бага)
      const leaving = app.sections[prev];
      if (leaving.isOurClients && leaving.oc && leaving.oc.collapse) leaving.oc.collapse();
      if (leaving.isProjects && leaving.pv && leaving.pv.collapse) leaving.pv.collapse();
      if (leaving.isHSwipe && leaving.hswipe && leaving.hswipe.collapse) leaving.hswipe.collapse();
      if (leaving.isWP && leaving.wp && leaving.wp.collapse) leaving.wp.collapse();
      gsap.to(leaving.el, {
        yPercent: 100,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: finish
      });
    }
    console.log('[Kulbit-Nav] секція', prev, '→', clamped);
  };

  // 08b — Персистентність позиції (sessionStorage): reload (і перебудова брейкпоінта) не скидають
  //        на hero. Зберігаємо при кожному goToSection; відновлюємо в кінці matchMedia-гілки.
  const SECTION_KEY = 'kulbit-section';
  app.persistSection = () => {
    try { sessionStorage.setItem(SECTION_KEY, String(app.currentSectionIndex)); } catch (e) {}
  };
  // Привести hero (секція 0) у КІНЕЦЬ його анімації — хедер ховається ШТАТНО (через таймлайн), а не
  //   зависає (інакше при стрибку/відновленні на не-hero хедер лишався вгорі). Скрол угору на hero
  //   потім коректно відмотає таймлайн і поверне хедер.
  app.passHero = () => {
    const hero = app.sections[0];
    if (!hero) return;
    if (hero.isAnimated && hero.timeline) hero.timeline.progress(1).pause();
    if (hero.isTabletHero && hero.tabletTL) hero.tabletTL.progress(1).pause();
  };
  app.restoreSection = () => {
    let saved = NaN;
    try { saved = parseInt(sessionStorage.getItem(SECTION_KEY), 10); } catch (e) {}
    if (isNaN(saved) || saved <= 0 || saved >= app.sections.length) return; // 0/немає → лишаємось на hero
    app.goToSection(saved, true, 1); // миттєвий перехід на збережену секцію (passHero — всередині goToSection)
    console.log('[Kulbit-Persist] відновлено секцію', saved);
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

    // is-projects (ADR-015, десктоп): свап відео всередині секції
    if (section.isProjects && section.pv) {
      if (section.pv.step(dir)) return;                       // свап усередині оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // is-our-services: горизонтальний свап карток усередині секції
    if (section.isHSwipe && section.hswipe) {
      if (section.hswipe.step(dir)) return;                   // свап усередині оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // is-working-process: stack-cards усередині секції
    if (section.isWP && section.wp) {
      if (section.wp.step(dir)) return;                       // крок карток оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // footer: покроковий скрол якщо переповнює (ADR-020); на верхній межі — перехід угору
    if (section.isFooter && section.ft) {
      if (section.ft.step(dir)) return;                       // крок скролу оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // верх футера → попередня секція
      return;
    }

    // is-traditional-production: дворежимна секція (червона/синя фази) — section.tp (поки DESKTOP)
    if (section.isTraditional && section.tp) {
      if (section.tp.step(dir)) return;                       // крок усередині секції оброблено
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

  // 09b — Кнопкове автопрогравання (ADR-003): швидко «прокрутити» УСІ кроки анімацій + переходи
  //        секцій по черзі до цільової — як fullpage. Прискорюємо config на час послідовності,
  //        блокуємо ввід (Observer). Зупиняємось щойно дійшли до цільової секції (на її початку).
  app.autoAdvanceTo = (targetIndex) => {
    const t = Math.max(0, Math.min(targetIndex, app.sections.length - 1));
    if (app.autoPlaying || t === app.currentSectionIndex) return;
    const dir = t > app.currentSectionIndex ? 1 : -1;
    app.autoPlaying = true;
    if (app.observer) app.observer.disable();          // ввід OFF на час прогортування
    gsap.globalTimeline.timeScale(3);                  // прискорюємо ВСІ анімації (кроки + переходи) рівномірно
    const finishAuto = () => {
      gsap.globalTimeline.timeScale(1);
      app.autoPlaying = false;
      if (app.observer) app.observer.enable();
      console.log('[Kulbit-Nav] авто-перехід завершено на секції', app.currentSectionIndex);
    };
    let guard = 0;
    const tick = () => {                               // setTimeout — реальний час (не під timeScale)
      if (app.currentSectionIndex === t) { finishAuto(); return; }
      if (++guard > 300) { console.warn('[Kulbit-Nav] авто-перехід: ліміт кроків'); finishAuto(); return; }
      if (app.isAnimating) { setTimeout(tick, 25); return; } // чекаємо завершення поточного кроку
      app.advance(dir);                                      // наступний крок або перехід секції
      setTimeout(tick, 50);
    };
    tick();
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
      // Швидко «прокручуємо» всі кроки анімацій + переходи секцій по черзі до цільової (як fullpage)
      console.log('[Kulbit-Nav] клік → секція', index);
      app.autoAdvanceTo(index);
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
      // Відео у fullscreen (нативний iOS-плеєр / desktop): поворот НЕ має тригерити попап чи паузити
      //   відео — інакше landscape у fullscreen одразу глушив би перегляд. Стан фіксує 10-project-video.
      if (app.videoFullscreen) {
        app.landscapeBlocked = false;
        popup.style.display = 'none';
        console.log('[Kulbit-Responsive] відео fullscreen — попап OFF, поворот ігноровано');
        return;
      }
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

    app.reapplyResponsive = apply; // 10-project-video кличе після зміни fullscreen-стану відео
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
    if (app.videoFullscreen) return;  // відео у fullscreen — не чіпаємо (грає незалежно від навігації)
    if (app.landscapeBlocked) return; // landscape-попап — нічого не граємо
    (app.videos || []).forEach((rec) => {
      if (rec.sectionIndex === app.currentSectionIndex) rec.show();
    });
  };

  window.KulbitApp.hideOtherVideos = () => {
    const app = window.KulbitApp;
    if (app.videoFullscreen) return;  // відео у fullscreen — не паузимо (поворот не має глушити перегляд)
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


// ====================================================================
// 10-project-video.js — Vimeo-плеєр проєктів із кастомними контролами + cover
//
//   Відкрите відео-портфоліо (секція is-projects): кероване користувачем
//   (НЕ background-autoplay, на відміну від hero у 08-video.js). Усе керування —
//   власні елементи, GSAP лише для плавних дрібниць (іконки, попап).
//
//   Розмітка (усе всередині кореня [data-kulbit-project-video] = .projects-video-wrapper):
//   • [data-kulbit-project-video] — КОРІНЬ (relative; overflow:hidden), усередині <iframe> Vimeo
//     (у src: &controls=0 — рідні контроли off; unlisted → ?h=<хеш>)
//   • [data-kulbit-poster]   — постер (показ до старту; absolute, inset:0, cover)
//   • [data-kulbit-play]     — велика центральна кнопка старту
//   • [data-kulbit-controls] — панель (display:none дефолт; JS показує після старту)
//   •   [data-kulbit-toggle] із [data-kulbit-icon-play] / [data-kulbit-icon-pause]
//   •   [data-kulbit-time-current] / [data-kulbit-time-total] — таймери (M:SS)
//   •   [data-kulbit-seek] із [data-kulbit-seek-fill] (прогрес) + [data-kulbit-buffer] (завантажено)
//   •   [data-kulbit-volume] із [data-kulbit-icon-volume] / [data-kulbit-icon-mute],
//       [data-kulbit-volume-popup] > [data-kulbit-volume-track] > [data-kulbit-volume-fill]
//   •   [data-kulbit-fullscreen] — розгортання кореня нативним Fullscreen API
//
//   Пауза за кадром: відео реєструється в app.videos із hide()=пауза (show — no-op,
//   бо плей лише вручну). Навігація (03-sections.js) кличе hideOtherVideos на
//   завершенні переходу → звук не грає, коли секцію накрито стекінгом / у landscape.
// ====================================================================

console.log('[Kulbit] 10-project-video.js завантажено');

// ## — Vimeo-плеєр проєктів
(() => {
  const ASPECT = 16 / 9;     // співвідношення відео для cover-розрахунку
  const ICON_DUR = 0.15;     // перемикання іконок (play/pause, volume/mute)
  const POPUP_DUR = 0.2;     // поява/зникання попапа гучності
  const FADE_DUR = 0.3;      // згасання постера/кнопки на старті
  const COMPACT_MAX = 991;   // ≤ цього (tablet/mobile): fullscreen через Vimeo SDK + кнопка звуку = мут

  // На tablet/mobile (≤991): div-fullscreen не працює на iOS → беремо нативний fullscreen відео
  //   через Vimeo SDK; повзунок гучності iOS ігнорує → кнопка звуку стає простою мут-кнопкою.
  const isCompact = () => window.innerWidth <= COMPACT_MAX;

  // Реєстр усіх project-плеєрів — щоб грало лише ОДНЕ відео: старт нового скидає решту на постер.
  const registry = [];

  // 01 — cover: розмір iframe так, щоб 16:9 ПОКРИВАЛО корінь; зайве ховає overflow:hidden.
  //      Рахуємо від кореня (не вьюпорта) — тримається й у fullscreen.
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

  // 02 — секунди → M:SS
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' + sec : '' + sec);
  };

  // 03 — Ініціалізація одного відео-блоку. Повертає запис { player, sectionIndex, show, hide }.
  const initProjectVideo = (root) => {
    root.style.position = 'relative';
    root.style.overflow = 'hidden';

    const iframe = root.querySelector('iframe');
    if (!iframe) {
      console.error('[Kulbit-PV] ❌ у [data-kulbit-project-video] немає <iframe> — встав ембед Vimeo з &controls=0');
      return null;
    }
    // Vimeo-iframe (cross-origin) перехоплює wheel → Observer не отримує скрол над відео.
    //   Контроли в нас власні (поверх відео), тож iframe-у події миші не потрібні: вимикаємо
    //   pointer-events, щоб колесо «проходило наскрізь» до Observer (кнопки лишаються клікабельні).
    iframe.style.pointerEvents = 'none';

    const poster      = root.querySelector('[data-kulbit-poster]');
    const bigPlay     = root.querySelector('[data-kulbit-play]');
    const controls    = root.querySelector('[data-kulbit-controls]');
    const toggle      = root.querySelector('[data-kulbit-toggle]');
    const iconPlay    = root.querySelector('[data-kulbit-icon-play]');
    const iconPause   = root.querySelector('[data-kulbit-icon-pause]');
    const timeCurrent = root.querySelector('[data-kulbit-time-current]');
    const timeTotal   = root.querySelector('[data-kulbit-time-total]');
    const seek        = root.querySelector('[data-kulbit-seek]');
    const seekFill    = root.querySelector('[data-kulbit-seek-fill]');
    const buffer      = root.querySelector('[data-kulbit-buffer]');
    const volume      = root.querySelector('[data-kulbit-volume]');
    const popup       = root.querySelector('[data-kulbit-volume-popup]');
    const track       = root.querySelector('[data-kulbit-volume-track]');
    const fill        = root.querySelector('[data-kulbit-volume-fill]');
    const iconVolume  = root.querySelector('[data-kulbit-icon-volume]');
    const iconMute    = root.querySelector('[data-kulbit-icon-mute]');
    const fsBtn       = root.querySelector('[data-kulbit-fullscreen]');

    const player = new Vimeo.Player(iframe);

    let duration = 0;
    let seekDrag = false, seekFrac = 0; // перетяг доріжки
    let volDrag = false;                // перетяг повзунка гучності
    let popupOpen = false;

    // --- іконка play/pause за реальним станом плеєра ---
    const setToggleIcon = (playing) => {
      if (iconPause) gsap.to(iconPause, { autoAlpha: playing ? 1 : 0, duration: ICON_DUR });
      if (iconPlay)  gsap.to(iconPlay,  { autoAlpha: playing ? 0 : 1, duration: ICON_DUR });
    };

    // --- прогрес + поточний час за часткою 0..1 ---
    const renderProgress = (frac) => {
      if (seekFill) seekFill.style.width = (frac * 100) + '%';
      if (timeCurrent) timeCurrent.textContent = fmt(frac * duration);
    };
    const seekFracFromX = (clientX) => {
      const rect = seek.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };

    // --- гучність (вертикальний повзунок: верх = більше) ---
    const setVolumeIcon = (v) => {
      const muted = v <= 0.001;
      if (iconVolume) gsap.to(iconVolume, { autoAlpha: muted ? 0 : 1, duration: ICON_DUR });
      if (iconMute)   gsap.to(iconMute,   { autoAlpha: muted ? 1 : 0, duration: ICON_DUR });
    };
    const applyVolume = (v) => {
      if (fill) fill.style.height = (v * 100) + '%';
      player.setVolume(v);
      setVolumeIcon(v);
    };
    const volFracFromY = (clientY) => {
      const rect = track.getBoundingClientRect();
      return Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height));
    };

    // --- плавний попап гучності (fade + легкий під'їзд) ---
    const openPopup = () => {
      popupOpen = true;
      if (!popup) return;
      gsap.killTweensOf(popup);
      popup.style.display = 'flex';
      gsap.fromTo(popup, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: POPUP_DUR, ease: 'power2.out' });
    };
    const closePopup = (instant) => {
      popupOpen = false;
      if (!popup) return;
      gsap.killTweensOf(popup);
      if (instant) { gsap.set(popup, { autoAlpha: 0, y: 8 }); popup.style.display = 'none'; return; }
      gsap.to(popup, { autoAlpha: 0, y: 8, duration: POPUP_DUR, ease: 'power2.in',
        onComplete: () => { if (!popupOpen) popup.style.display = 'none'; } }); // guard від гонки відкр/закр
    };

    // --- fullscreen (корінь розгортається; контроли лишаються, бо вони його діти) ---
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const enterFs = () => {
      // tablet/mobile: нативний fullscreen відео через Vimeo SDK (div-fullscreen не працює на iOS;
      //   вихід — нативною кнопкою плеєра). Desktop: розгортаємо корінь із власними контролами.
      if (isCompact() && player.requestFullscreen) {
        player.requestFullscreen().catch((e) => console.warn('[Kulbit-PV] SDK fullscreen відхилено:', e && e.name));
        return;
      }
      if (root.requestFullscreen) root.requestFullscreen();
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
      else console.warn('[Kulbit-PV] fullscreen API недоступне на цьому пристрої');
    };
    const exitFs = () => {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    };

    // --- стартовий стан: постер + велика кнопка видимі, панель схована ---
    const showInitial = () => {
      if (poster)  gsap.set(poster,  { autoAlpha: 1 });
      if (bigPlay) gsap.set(bigPlay, { autoAlpha: 1 });
      if (controls) controls.style.display = 'none';
      setToggleIcon(false);
      closePopup(true);
      if (timeCurrent) timeCurrent.textContent = '0:00';
      if (seekFill) seekFill.style.width = '0%';
      if (buffer) buffer.style.width = '0%';
    };

    // --- повне скидання у початковий стан (для «грає лише одне»): пауза + час 0 + постер ---
    const resetToInitial = () => {
      player.pause();
      player.setCurrentTime(0);
      showInitial();
    };

    // --- перший старт: ховаємо постер + кнопку, показуємо панель ---
    const startPlayback = () => {
      // МОМЕНТАЛЬНО на клік (до play-події, без лагу) скидаємо решту project-відео на постер
      registry.forEach((other) => { if (other.player !== player) other.resetToInitial(); });
      if (poster)  gsap.to(poster,  { autoAlpha: 0, duration: FADE_DUR });
      if (bigPlay) gsap.to(bigPlay, { autoAlpha: 0, duration: FADE_DUR });
      if (controls) controls.style.display = 'flex';
      // Перший клік -- лише старт. iOS стартує inline-відео muted й не дає розмутити в тому ж
      //   кліку (на відміну від hero, що ВЖЕ грає). Звук вмикається окремою кнопкою гучності/мут
      //   (unmute граючого відео в gesture — там працює, як у hero). На desktop play() дає звук одразу.
      player.play();
    };

    // --- готовність: cover + ресайз-спостерігач + тривалість + початкова гучність ---
    player.ready().then(() => {
      applyCover(root, iframe);
      new ResizeObserver(() => applyCover(root, iframe)).observe(root);
      showInitial();
      return player.getDuration();
    }).then((d) => {
      duration = d;
      if (timeTotal) timeTotal.textContent = fmt(d);
      return player.getVolume();
    }).then((v) => {
      if (fill) fill.style.height = (v * 100) + '%';
      setVolumeIcon(v);
      console.log('[Kulbit-PV] ✅ плеєр готовий (cover активний)');
    }).catch((e) => console.error('[Kulbit-PV] ❌ помилка завантаження:', e));

    // --- play / pause ---
    if (bigPlay) bigPlay.addEventListener('click', startPlayback);
    if (toggle) toggle.addEventListener('click', () => {
      player.getPaused().then((paused) => { if (paused) player.play(); else player.pause(); });
    });

    // --- перемотка: клік або перетяг по доріжці ---
    if (seek) {
      seek.addEventListener('pointerdown', (e) => {
        seekDrag = true; seekFrac = seekFracFromX(e.clientX);
        renderProgress(seekFrac); seek.setPointerCapture(e.pointerId);
      });
      seek.addEventListener('pointermove', (e) => {
        if (!seekDrag) return; seekFrac = seekFracFromX(e.clientX); renderProgress(seekFrac);
      });
      seek.addEventListener('pointerup', () => {
        if (!seekDrag) return; seekDrag = false; player.setCurrentTime(seekFrac * duration);
      });
    }

    // --- гучність: tablet/mobile — проста мут-кнопка; desktop — попап із повзунком ---
    if (volume) volume.addEventListener('click', (e) => {
      // tablet/mobile: тільки mute/unmute (рівень гучності iOS ігнорує, повзунок безсенсовий)
      if (isCompact()) {
        player.getMuted().then((m) => { player.setMuted(!m); setVolumeIcon(!m ? 0 : 1); });
        return;
      }
      if (popup && popup.contains(e.target)) return; // клік усередині попапа не перемикає
      if (popupOpen) closePopup(); else openPopup();
    });
    document.addEventListener('click', (e) => {
      if (popupOpen && volume && !volume.contains(e.target)) closePopup();
    });

    // --- гучність: вертикальний повзунок (клік/перетяг) ---
    if (track) {
      track.addEventListener('pointerdown', (e) => {
        volDrag = true; applyVolume(volFracFromY(e.clientY)); track.setPointerCapture(e.pointerId);
      });
      track.addEventListener('pointermove', (e) => {
        if (!volDrag) return; applyVolume(volFracFromY(e.clientY));
      });
      track.addEventListener('pointerup', () => { volDrag = false; });
    }

    // --- fullscreen ---
    if (fsBtn) fsBtn.addEventListener('click', () => { if (fsElement()) exitFs(); else enterFs(); });
    const onFsChange = () => {
      applyCover(root, iframe);
      // Desktop: у fullscreen (наш root) блокуємо навігацію — щоб колесо не гортало секції під відео.
      //   Вийшли — вмикаємо назад. На compact fullscreen нативний (Vimeo iframe), document.fullscreenElement
      //   порожній → Observer не чіпаємо (нативний плеєр і так перекриває екран).
      const app = window.KulbitApp;
      if (app && app.observer) { if (fsElement()) app.observer.disable(); else app.observer.enable(); }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    // --- синхронізація UI з реальним станом плеєра ---
    player.on('play',  () => {
      setToggleIcon(true);
      // грає лише ОДНЕ: старт цього відео скидає решту project-відео на початковий стан (постер)
      registry.forEach((other) => { if (other.player !== player) other.resetToInitial(); });
    });
    player.on('pause', () => setToggleIcon(false));
    player.on('ended', () => setToggleIcon(false));
    // Стан fullscreen відео (нативний Vimeo iOS / desktop) — щоб 06-responsive не показував попап
    //   і не паузив відео при повороті телефона у fullscreen.
    player.on('fullscreenchange', (data) => {
      const app = window.KulbitApp || {};
      app.videoFullscreen = !!(data && data.fullscreen);
      if (app.reapplyResponsive) app.reapplyResponsive();
    });
    // Іконка звуку — завжди за РЕАЛЬНИМ станом (а не за припущенням): muted → mute-іконка, інакше рівень
    player.on('volumechange', (data) => {
      player.getMuted().then((m) => setVolumeIcon(m ? 0 : (data && data.volume != null ? data.volume : 1)));
    });
    player.on('timeupdate', (data) => {
      if (seekDrag) return;
      if (data.duration) duration = data.duration;
      renderProgress(data.percent || 0); // percent = зіграна частка
    });
    player.on('progress', (data) => {
      if (buffer) buffer.style.width = ((data.percent || 0) * 100) + '%'; // percent = завантажена частка
    });

    // Запис для пауза-за-кадром (08-video.js хазяйнує app.videos):
    //   hide — пауза (секцію накрито / landscape); show — no-op (плей лише вручну).
    const sectionEl = root.closest('[data-kulbit-section]');
    const sectionIndex = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;
    registry.push({ player, resetToInitial }); // реєструємо для «грає лише одне відео»
    return {
      player, sectionIndex,
      show: () => {},                 // кероване користувачем — НЕ автоплей
      hide: () => player.pause()      // за кадром — пауза (без звуку off-screen)
    };
  };

  // 04 — Старт після готовності DOM
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Vimeo === 'undefined') {
      console.error('[Kulbit-PV] ❌ Vimeo Player SDK не підключено (player.js перед бандлом)');
      return;
    }
    const roots = document.querySelectorAll('[data-kulbit-project-video]');
    if (!roots.length) {
      console.log('[Kulbit-PV] відео-блоків [data-kulbit-project-video] немає');
      return;
    }
    const app = window.KulbitApp = window.KulbitApp || {};
    app.videos = app.videos || [];
    roots.forEach((root) => {
      const rec = initProjectVideo(root);
      if (rec) app.videos.push(rec);
    });
  });
})();


// ====================================================================
// 11-scramble.js — Поява тексту за атрибутом (scramble АБО typewriter)
//
//   Два атрибути, спільна механіка:
//   • [data-kulbit-scramble]   — текст «пишеться» скрамблом (через GSAP ScrambleTextPlugin);
//   • [data-kulbit-typewriter] — текст ДРУКУЄТЬСЯ по літерах (typewriter, без плагіна — tween числа).
//
//   Обидва: зʼявляються коли елемент потрапляє у вьюпорт (наповзання секції), стираються на виході
//   (для повторної появи). Сегментують вміст зі збереженням спанів (кольори).
//
//   Контролери — у app.scrambles (Map: el → { in, out, setOut }) — секції з власною хореографією
//   (is-our-services) керують вручну через app.scrambles.get(el). Re-runnable на resize.
// ====================================================================

console.log('[Kulbit] 11-scramble.js завантажено');

// ## — Поява тексту за атрибутом (scramble / typewriter)
(() => {
  const SC = { chars: 'upperCase', speed: 1 };
  const DUR = 1.2; // тривалість появи/стирання (секунди)

  // Розрізати вміст на сегменти [текст, клас] — щоб зберегти кольорові спани
  const parseSegments = (e) => {
    const segs = [];
    e.childNodes.forEach((n) => {
      if (n.nodeType === 3) segs.push([n.textContent, '']);
      else if (n.nodeType === 1) segs.push([n.textContent, n.getAttribute('class') || '']);
    });
    return segs;
  };
  // Відбудувати DOM зі спанів (із текстом або без), повернути [span, text] для tween-ів
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

  // Контролер одного елемента: in (порожньо→текст), out (текст→порожньо), setOut (миттєво порожньо).
  //   mode: 'scramble' (ScrambleTextPlugin) або 'typewriter' (tween числа + slice — без плагіна).
  const makeReveal = (el, mode) => {
    if (el.dataset.scrOrig == null) el.dataset.scrOrig = el.innerHTML;
    else el.innerHTML = el.dataset.scrOrig;
    el.style.height = ''; el.style.overflow = '';
    const targets = buildSegDOM(el, parseSegments(el), true);
    el.style.height = el.offsetHeight + 'px';   // фіксуємо висоту (стабільно при появі/стиранні)
    el.style.overflow = 'hidden';
    let shown = true, tl = null;
    const animateTo = (show) => {
      if (tl) tl.kill();
      tl = gsap.timeline();
      // typewriter: spans пишуться ПОСЛІДОВНО (один за одним); тривалість span — пропорційна
      //   його довжині (так усі літери йдуть з однаковою швидкістю, сумарно ≈ DUR).
      const totalChars = mode === 'typewriter'
        ? (targets.reduce((sum, [, t]) => sum + t.length, 0) || 1)
        : 0;
      targets.forEach(([s, t]) => {
        if (mode === 'typewriter') {
          const spanDur = (t.length / totalChars) * DUR;
          const o = { p: show ? 0 : 1 };
          tl.to(o, {
            p: show ? 1 : 0, duration: spanDur, ease: 'none',
            onUpdate: () => { s.textContent = t.slice(0, Math.ceil(o.p * t.length)); }
          }); // без position → у кінець попереднього (послідовно)
        } else {
          tl.to(s, { duration: DUR, scrambleText: { text: show ? t : '', ...SC } }, 0); // scramble — паралельно
        }
      });
      shown = show;
    };
    return {
      el, mode,
      in()  { if (!shown) animateTo(true); },
      out() { if (shown) animateTo(false); },
      setOut() { if (tl) tl.kill(); targets.forEach(([s]) => { s.textContent = ''; }); shown = false; }
    };
  };

  // Збірка/перезбірка: збираємо обидва атрибути, IO керує появою/виходом. Re-runnable на resize
  //   (висота елемента залежить від брейкпоінта; makeReveal відновлює оригінал і переміряє).
  let io = null, resizeTimer = null;
  const build = () => {
    const app = window.KulbitApp = window.KulbitApp || {};
    app.scrambles = app.scrambles || new Map();
    if (io) io.disconnect();
    app.scrambles.clear();
    const scrambleEls   = [...document.querySelectorAll('[data-kulbit-scramble]')].map((el) => [el, 'scramble']);
    const typewriterEls = [...document.querySelectorAll('[data-kulbit-typewriter]')].map((el) => [el, 'typewriter']);
    const all = [...scrambleEls, ...typewriterEls];
    if (!all.length) { console.log('[Kulbit-Reveal] елементів [data-kulbit-scramble]/[data-kulbit-typewriter] немає'); return; }
    all.forEach(([el, mode]) => {
      const ctrl = makeReveal(el, mode);
      ctrl.setOut();                        // старт порожньо — зʼявляться при вході у вьюпорт
      app.scrambles.set(el, ctrl);
    });
    // Поява у вьюпорті → IN; повний вихід → стираємо (готуємо до повторної появи)
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const ctrl = app.scrambles.get(en.target);
        if (!ctrl) return;
        if (en.intersectionRatio >= 0.6) ctrl.in();
        else if (!en.isIntersecting) ctrl.out();
      });
    }, { threshold: [0, 0.6] });
    all.forEach(([el]) => io.observe(el));
    console.log('[Kulbit-Reveal] активний:', scrambleEls.length, 'scramble +', typewriterEls.length, 'typewriter');
  };

  document.addEventListener('DOMContentLoaded', build);
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 200); });
})();
