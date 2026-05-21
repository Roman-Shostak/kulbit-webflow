// ====================================================================
// 03-sections.js — Реєстрація секцій з DOM + перехід між ними
//                  (методи додаються до KulbitApp з 02-app-core.js)
// ====================================================================

console.log('[Kulbit] 03-sections.js завантажено');

// ## — Методи роботи з секціями
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // 01 — Реєстрація секцій з DOM.
  //      Індекс проставляє JS з DOM-порядку (reorder-safe — нічого не хардкодимо).
  app.registerSections = () => {
    const els = document.querySelectorAll('[data-kulbit-section]');
    app.sections = Array.from(els).map((el, index) => {
      el.setAttribute('data-section-index', index);
      return { el, index, isFooter: el.classList.contains('footer') };
    });

    if (!app.sections.length) {
      console.error('[Kulbit-Sections] ❌ Не знайдено секцій [data-kulbit-section]');
      return;
    }
    console.log('[Kulbit-Sections] зареєстровано секцій:', app.sections.length);
  };

  // 02 — Перехід на секцію: зсуваємо трек так, щоб верх секції став верхом екрана.
  //      instant = true → миттєво без анімації (для ресайзу).
  app.goToSection = (index, instant) => {
    if (!app.sections.length || !app.content) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const targetY = app.sections[clamped].el.offsetTop;
    app.currentSectionIndex = clamped;

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
})();
