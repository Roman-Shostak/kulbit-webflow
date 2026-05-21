// ====================================================================
// 03-sections.js — Секції + кроки: реєстрація з DOM, переходи, покрокові анімації
//                  (методи додаються до KulbitApp з 02-app-core.js)
//
//   Два типи покрокових секцій (детектяться з розмітки):
//   • reveal-кроки  — елементи [data-kulbit-step] (дефолтний показ autoAlpha+y)
//   • кастомний таймлайн — елементи з [data-kulbit-y] / [data-kulbit-scale] /
//     [data-kulbit-fade] складаються в один GSAP-таймлайн (ADR-009).
// ====================================================================

console.log('[Kulbit] 03-sections.js завантажено');

// ## — Методи роботи з секціями, кроками та кастомними таймлайнами
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
  //      Тільки desktop (≥992px) — на таблеті/мобілці інший hero (Крок 8).
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

  // 08 — Перехід на секцію. dir задає стан кроків нової секції:
  //      вхід згори (dir>0) → кроки/таймлайн на початку; знизу (dir<0) → у кінці (щоб відмотувати).
  app.goToSection = (index, instant, dir) => {
    if (!app.sections.length || !app.content) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const prev = app.currentSectionIndex;
    if (clamped === prev && !instant) return; // межа — нікуди не йдемо

    const section = app.sections[clamped];
    app.currentSectionIndex = clamped;

    // Стан кроків нової секції
    if (section.isAnimated && section.timeline) {
      const atEnd = dir < 0;                       // вхід знизу → таймлайн у кінці
      section.timeline.progress(atEnd ? 1 : 0).pause();
      app.currentStep = atEnd ? 1 : 0;
    } else if (section.isStepped) {
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

    // Кроків у цьому напрямі немає → міняємо секцію
    app.goToSection(app.currentSectionIndex + dir, false, dir);
  };

  // 10 — Перехід на секцію + конкретний крок (для кнопок data-target-step).
  //      Кастомний таймлайн: крок ≥1 → кінець, інакше початок. Reveal: показати перші `step`.
  app.goToSectionStep = (index, targetStep) => {
    if (!app.sections.length || !app.content) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const section = app.sections[clamped];
    const maxStep = section.isAnimated ? 1 : (section.isStepped ? section.steps.length : 0);
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
