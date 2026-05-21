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
})();
