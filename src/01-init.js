// ====================================================================
// 01-init.js — Ініціалізація ScrollSmoother + реєстрація GSAP-плагінів
// Kulbit — кастомний сайт на Webflow + GSAP
// ====================================================================

console.log('[Kulbit] 01-init.js завантажено');

// ## — Ініціалізація ScrollSmoother (огорнуто в IIFE, щоб не засмічувати глобал)
(() => {
  // Конфіг ScrollSmoother — оптимально для лендингу
  const config = {
    smooth: 1.2,             // згладжування скролу на десктопі (сек)
    effects: true,           // вмикає data-speed / data-lag (parallax)
    normalizeScroll: true,   // нормалізація скролу — важливо для iOS Safari
    smoothTouch: 0.1,        // легке згладжування на тач-девайсах
    ignoreMobileResize: true // ігнорувати resize від URL-бару на мобілці
  };

  // Ініціалізація після готовності DOM
  document.addEventListener('DOMContentLoaded', () => {
    // 01 — Перевірка наявності GSAP та ScrollSmoother
    if (typeof gsap === 'undefined' || typeof ScrollSmoother === 'undefined') {
      console.error('[Kulbit-Init] ❌ GSAP або ScrollSmoother не завантажені — ScrollSmoother не створено');
      return;
    }

    // 02 — Реєстрація плагінів
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
    console.log('[Kulbit-Init] Плагіни зареєстровано');

    // 03 — Якщо інстанс уже існує (повторна ініціалізація) — прибираємо
    const existing = ScrollSmoother.get();
    if (existing) {
      existing.kill();
      console.log('[Kulbit-Init] Старий інстанс ScrollSmoother прибрано');
    }

    // 04 — Створення ScrollSmoother
    const smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: config.smooth,
      effects: config.effects,
      normalizeScroll: config.normalizeScroll,
      smoothTouch: config.smoothTouch,
      ignoreMobileResize: config.ignoreMobileResize
    });

    // 05 — Виставляємо інстанс у глобальний обʼєкт для доступу з інших модулів
    //      (повноцінний KulbitApp буде створено у 02-app-core.js на Кроці 3)
    window.KulbitApp = window.KulbitApp || {};
    window.KulbitApp.smoother = smoother;

    console.log('[Kulbit-Init] ✅ ScrollSmoother створено та виставлено у window.KulbitApp.smoother');
  });
})();
