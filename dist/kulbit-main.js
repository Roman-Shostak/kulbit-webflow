/* Kulbit Webflow — зібрано 2026-05-21T15:53:32.487Z */

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
        steps: [], isStepped: false,   // reveal-кроки
        timeline: null, isAnimated: false // кастомний таймлайн (ADR-009)
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

  // 03 — Реєстрація кастомних таймлайнів (ADR-009).
  //      Тільки desktop (≥992px) — на таблеті/мобілці інший hero (Крок 8 / фаза 2).
  //      Елементи прив'язуємо до секції через closest; ті, що поза секціями
  //      (напр. header), йдуть до hero — секції 0.
  app.registerAnimations = () => {
    if (!window.matchMedia('(min-width: 992px)').matches) {
      console.log('[Kulbit-Anim] не desktop — кастомні таймлайни секцій вимкнено');
      return;
    }

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
      console.log(`[Kulbit-Anim] секція ${idx}: кастомний таймлайн, елементів: ${els.length}`);
    });
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
    if (target.isAnimated && target.timeline) {
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
      return;
    }

    app.isAnimating = true;
    if (dir > 0) {
      // вниз: ціль наповзає знизу поверх поточної
      gsap.to(target.el, {
        yPercent: 0,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => { app.isAnimating = false; }
      });
    } else {
      // вгору: поточна сповзає вниз, відкриваючи попередню
      gsap.to(app.sections[prev].el, {
        yPercent: 100,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => { app.isAnimating = false; }
      });
    }
    app.currentSectionIndex = clamped;
    console.log('[Kulbit-Nav] секція', prev, '→', clamped);
  };

  // 09 — advance: вирішує — наступний КРОК у поточній секції чи перехід на СЕКЦІЮ.
  //      Викликається обробником жесту (02-app-core.js) та кнопками.
  app.advance = (dir) => {
    const section = app.sections[app.currentSectionIndex];

    // Кастомний таймлайн (hero): крок 0 ↔ 1
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
// 08-video.js — Vimeo фонове відео: cover + перемикач звуку
//
//   Відео ЗАВЖДИ вставляється як <iframe> у Webflow Embed (НЕ через JS).
//   Розмітка:
//   • контейнер: [data-kulbit-video], усередині — <iframe> Vimeo;
//     у src ОБОВ'ЯЗКОВО &background=1 (autoplay + loop + muted + без UI),
//     unlisted-відео → ?h=<хеш> у src.
//   • кнопка звуку (опційно, у тій же секції): [data-kulbit-sound] з іконками
//     .icon-24 (динамік) та .icon-24.is-mute (перекреслена).
//
//   Модуль прикріплюється до iframe (Vimeo SDK) для керування звуком,
//   рахує cover від контейнера (тримається під scale-анімацією) і перемикає
//   muted + іконки по кліку. Скейл відео (1.3→1) робить рушій таймлайну
//   (03-sections.js, ADR-009), не цей модуль.
// ====================================================================

console.log('[Kulbit] 08-video.js завантажено');

// ## — Фонове Vimeo-відео
(() => {
  const ASPECT = 16 / 9; // співвідношення відео (для cover-розрахунку)

  // 01 — cover: розмір iframe так, щоб 16:9 ПОКРИВАЛО контейнер; зайве ховає overflow:hidden.
  //      Рахуємо від контейнера (не вьюпорта) — тримається й під час scale-анімації.
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

  // 02 — Стан іконок: muted → перекреслена (.is-mute); звук → динамік (.icon-24)
  const setSoundIcons = (btn, muted, animate) => {
    const iSound = btn.querySelector('.icon-24:not(.is-mute)');
    const iMute = btn.querySelector('.icon-24.is-mute');
    const dur = animate ? 0.2 : 0;
    if (iSound) gsap.to(iSound, { autoAlpha: muted ? 0 : 1, duration: dur });
    if (iMute) gsap.to(iMute, { autoAlpha: muted ? 1 : 0, duration: dur });
  };

  // 03 — Ініціалізація одного відео-блоку
  const initVideo = (box) => {
    // Контейнер — система координат для iframe + ховає overflow (для cover)
    box.style.position = 'relative';
    box.style.overflow = 'hidden';

    let iframe = box.querySelector('iframe');
    if (!iframe) {
      console.error('[Kulbit-Video] ❌ у [data-kulbit-video] немає <iframe> — встав ембед Vimeo з &background=1');
      return null;
    }

    // Якщо iframe загорнутий у стандартну padding-обгортку Vimeo (56.25%) —
    // витягуємо його прямо в контейнер (інакше cover ламається об обгортку).
    if (iframe.parentElement && iframe.parentElement !== box) {
      const wrap = iframe.parentElement;
      box.appendChild(iframe);
      wrap.remove();
    }

    // Прикріплюємось до наявного iframe (фон-параметри — у src ембеда)
    const player = new Vimeo.Player(iframe);

    player.ready().then(() => {
      applyCover(box, iframe);
      // Перерахунок cover при зміні розміру контейнера (ресайз вікна)
      new ResizeObserver(() => applyCover(box, iframe)).observe(box);
      console.log('[Kulbit-Video] ✅ плеєр готовий (cover активний)');
    }).catch((e) => console.error('[Kulbit-Video] ❌ помилка завантаження:', e));

    // 04 — Кнопка звуку (шукаємо в межах секції відео; може бути відсутня)
    const scope = box.closest('[data-kulbit-section]') || document;
    const btn = scope.querySelector('[data-kulbit-sound]');
    if (btn) {
      setSoundIcons(btn, true, false); // старт muted (перекреслена), без анімації
      btn.addEventListener('click', () => {
        player.getMuted().then((m) => player.setMuted(!m).then(() => {
          const muted = !m;
          setSoundIcons(btn, muted, true);
          console.log('[Kulbit-Video] 🔊 muted →', muted);
        }));
      });
    }

    return player;
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
    window.KulbitApp = window.KulbitApp || {};
    window.KulbitApp.players = window.KulbitApp.players || [];
    boxes.forEach((box) => {
      const player = initVideo(box);
      if (player) window.KulbitApp.players.push(player);
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
