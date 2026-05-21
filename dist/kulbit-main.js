/* Kulbit Webflow — зібрано 2026-05-21T10:30:40.323Z */

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
    minVelocity: 60            // нижче цієї швидкості — «дотихання» інерції, ігноруємо
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
    app.observer = Observer.create({
      target: window,
      type: 'wheel,touch,pointer',
      tolerance: 10,
      preventDefault: true, // блокуємо нативний скрол — рухаємось ТІЛЬКИ по секціях
      onDown: (self) => handleGesture(1, self),
      onUp: (self) => handleGesture(-1, self),
      onStop: () => { flinging = false; prevVel = 0; } // приймаємо новий ввід лише коли все стихло
    });
    console.log('[Kulbit-Core] Observer створено (snap активний)');
  };

  // 06 — Перепозиціонування при ресайзі (offsetTop секцій змінюється).
  //      Репозиціонуємо трек напряму, НЕ через goToSection — щоб не скинути стан кроків.
  let resizeTimer = null;
  app.handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const section = app.sections[app.currentSectionIndex];
      if (section && app.content) {
        gsap.set(app.content, { y: -section.el.offsetTop });
        console.log('[Kulbit-Core] ресайз — перепозиціоновано на секцію', app.currentSectionIndex);
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
    app.registerSections(); // визначено у 03-sections.js
    app.registerSteps();    // визначено у 03-sections.js (детектить кроки з розмітки)
    app.setupObserver();
    window.addEventListener('resize', app.handleResize);
    console.log('[Kulbit-Core] ✅ KulbitApp ініціалізовано');
  };

  document.addEventListener('DOMContentLoaded', () => app.init());
})();


// ====================================================================
// 03-sections.js — Секції + кроки: реєстрація з DOM, переходи, покрокові анімації
//                  (методи додаються до KulbitApp з 02-app-core.js)
// ====================================================================

console.log('[Kulbit] 03-sections.js завантажено');

// ## — Методи роботи з секціями та кроками
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // 01 — Реєстрація секцій з DOM. Індекс проставляє JS з DOM-порядку (reorder-safe).
  app.registerSections = () => {
    const els = document.querySelectorAll('[data-kulbit-section]');
    app.sections = Array.from(els).map((el, index) => {
      el.setAttribute('data-section-index', index);
      return { el, index, isFooter: el.classList.contains('footer'), steps: [], isStepped: false };
    });

    if (!app.sections.length) {
      console.error('[Kulbit-Sections] ❌ Не знайдено секцій [data-kulbit-section]');
      return;
    }
    console.log('[Kulbit-Sections] зареєстровано секцій:', app.sections.length);
  };

  // 02 — Реєстрація кроків: для кожної секції збираємо [data-kulbit-step] у DOM-порядку.
  //      Покроковість детектиться З РОЗМІТКИ, не зі списку в JS.
  app.registerSteps = () => {
    app.sections.forEach((s) => {
      const stepEls = s.el.querySelectorAll('[data-kulbit-step]');
      stepEls.forEach((el, i) => el.setAttribute('data-step-index', i));
      s.steps = Array.from(stepEls);
      s.isStepped = s.steps.length > 0;
      if (s.isStepped) {
        app.resetSteps(s, false); // на старті всі кроки сховані
        console.log(`[Kulbit-Steps] секція ${s.index}: покрокова, кроків: ${s.steps.length}`);
      }
    });
  };

  // 03 — Стан кроків секції: shown=false → усі сховані; true → усі показані.
  //      Дефолтна анімація — autoAlpha + зсув по y (реальні кастомні замінять на Кроці 6).
  app.resetSteps = (section, shown) => {
    if (!section.isStepped) return;
    section.steps.forEach((el) => {
      gsap.set(el, shown ? { autoAlpha: 1, y: 0 } : { autoAlpha: 0, y: 40 });
    });
  };

  // 04 — Програти крок i (reveal)
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

  // 05 — Відмотати крок i (сховати)
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

  // 06 — Перехід на секцію. dir задає стан кроків нової секції:
  //      вхід згори (dir>0) → кроки сховані; знизу (dir<0) → усі показані (щоб відмотувати).
  app.goToSection = (index, instant, dir) => {
    if (!app.sections.length || !app.content) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const prev = app.currentSectionIndex;
    if (clamped === prev && !instant) return; // межа — нікуди не йдемо

    const section = app.sections[clamped];
    app.currentSectionIndex = clamped;

    // Стан кроків нової секції
    if (section.isStepped) {
      const shown = dir < 0;
      app.resetSteps(section, shown);
      app.currentStep = shown ? section.steps.length : 0;
    } else {
      app.currentStep = 0;
    }

    const targetY = section.el.offsetTop;
    if (instant) {
      gsap.set(app.content, { y: -targetY });
      return;
    }

    app.isAnimating = true;
    gsap.to(app.content, {
      y: -targetY,
      duration: app.config.scrollDuration,
      ease: app.config.ease,
      onComplete: () => { app.isAnimating = false; }
    });
    console.log('[Kulbit-Nav] секція →', clamped);
  };

  // 07 — advance: вирішує — наступний КРОК у поточній секції чи перехід на СЕКЦІЮ.
  //      Викликається обробником жесту (02-app-core.js) та кнопками.
  app.advance = (dir) => {
    const section = app.sections[app.currentSectionIndex];

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

    // Кроків у цьому напрямі немає (або секція не покрокова) → міняємо секцію
    app.goToSection(app.currentSectionIndex + dir, false, dir);
  };

  // 08 — Перехід на секцію + конкретний крок (для кнопок data-target-step).
  //      targetStep = скільки перших кроків показати; решта сховані. Швидке догравання.
  app.goToSectionStep = (index, targetStep) => {
    if (!app.sections.length || !app.content) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const section = app.sections[clamped];
    const maxStep = section.isStepped ? section.steps.length : 0;
    const step = Math.max(0, Math.min(targetStep || 0, maxStep));

    app.currentSectionIndex = clamped;
    app.currentStep = step;

    // Перехід на секцію (анімація треку)
    app.isAnimating = true;
    gsap.to(app.content, {
      y: -section.el.offsetTop,
      duration: app.config.scrollDuration,
      ease: app.config.ease,
      onComplete: () => { app.isAnimating = false; }
    });

    // Стан кроків: перші `step` швидко показуємо, решту ховаємо
    if (section.isStepped) {
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
// 06-responsive.js — Респонсив + попап для landscape mobile
// ====================================================================

console.log('[Kulbit] 06-responsive.js завантажено');

// Тут буде респонсив-логіка + детект landscape (Крок 8)


// ====================================================================
// 07-popup-form.js — Логіка попап-форми
// ====================================================================

console.log('[Kulbit] 07-popup-form.js завантажено');

// Тут буде попап-форма (Крок 9)


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
    sampleN: 64     // точність пошуку точки входу на периметрі
  };

  // Колір зі змінної проєкту (з фолбеком)
  const getBlue = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--colors--blue').trim() || '#62b0ff';

  // ## — Налаштування одного елемента. Повертає функцію rebuild (для resize).
  const setupElement = (el) => {
    const blue = getBlue();
    const state = { p: 0, center: 0, rect: null, svg: null, L: 0, w: 0, h: 0 };

    // Малюємо видимий сегмент довжиною frac*L, центрований на offset center (з обгортанням контуру)
    const draw = (center, frac) => {
      if (!state.rect) return;
      const len = frac * state.L;
      state.rect.style.strokeDasharray = `${len} ${state.L - len}`;
      state.rect.style.strokeDashoffset = `${len / 2 - center}`;
      state.rect.style.opacity = frac; // проявлення через opacity
    };

    // Перебудова SVG-оверлея під поточні розміри (init + resize)
    const build = () => {
      const cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const sw = parseFloat(cs.borderTopWidth) || 2;     // товщина лінії = товщині бордера
      const r = parseFloat(cs.borderTopLeftRadius) || 0; // радіус кутів

      if (state.svg) state.svg.remove();

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      Object.assign(svg.style, {
        position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'visible', zIndex: '2'
      });

      const i = sw / 2;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', i);
      rect.setAttribute('y', i);
      rect.setAttribute('width', w - sw);
      rect.setAttribute('height', h - sw);
      rect.setAttribute('rx', Math.max(0, r - i));
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
      draw(state.center, state.p); // відновлюємо поточний стан після перебудови
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

    // Анімація до стану target (1 = промальовано, 0 = згорнуто), від точки курсора
    const animate = (target, e) => {
      state.center = offsetFromMouse(e);
      gsap.killTweensOf(state);
      gsap.to(state, {
        p: target,
        duration: config.duration,
        ease: config.ease,
        onUpdate: () => draw(state.center, state.p)
      });
    };

    el.addEventListener('mouseenter', (e) => animate(1, e));
    el.addEventListener('mouseleave', (e) => animate(0, e));

    build();
    return build;
  };

  // ## — Ініціалізація після готовності DOM
  document.addEventListener('DOMContentLoaded', () => {
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
