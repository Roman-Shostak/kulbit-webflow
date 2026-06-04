// ====================================================================
// 12-hero-vh.js — Фікс висоти .section.is-hero через visualViewport API.
//   Arc Mobile / iOS: 100vh != реальна видима висота (адресний бар) → hero-контент
//   (justify-content:flex-end) ховається за UI. Тож hero-секції ставимо точну видиму
//   висоту. Раніше — окремий інлайн-скрипт у Webflow (Webflow.push); перенесено в бандл,
//   щоб логи зачищались у прод-білді (CLAUDE.md §9). Іде ОСТАННІМ (після setupStacking,
//   що ставить секціям 100vh) → коректно перебиває висоту саме hero.
// ====================================================================

console.log('[Kulbit] 12-hero-vh.js завантажено');

// ## — Висота hero = реальна видима висота вьюпорта (не 100vh)
(() => {
  const PREFIX = '[Kulbit-HeroVH]';
  const SELECTOR = '.section.is-hero';

  document.addEventListener('DOMContentLoaded', () => {
    let rafId = null;

    // Реальна видима висота: visualViewport (точно враховує UI браузера) з фолбеком на innerHeight
    const realViewportHeight = () =>
      (window.visualViewport && window.visualViewport.height) || window.innerHeight;

    // Застосувати висоту до hero-секцій
    const applyHeroHeight = () => {
      const height = realViewportHeight();
      const heroSections = document.querySelectorAll(SELECTOR);
      if (!heroSections.length) {
        console.log(PREFIX + ' не знайдено елементів за селектором ' + SELECTOR);
        return;
      }
      heroSections.forEach((section) => { section.style.height = height + 'px'; });
      console.log(PREFIX + ' висоту оновлено: ' + height + 'px (елементів: ' + heroSections.length + ')');
    };

    // rAF — плавне оновлення без зайвих перерахунків
    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(applyHeroHeight);
    };

    applyHeroHeight(); // перший запуск після готовності DOM

    // Слухачі змін вьюпорта (поява/зникнення UI браузера, клавіатури тощо)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', () => {
      // після повороту браузер віддає коректну висоту не одразу — невелика затримка
      setTimeout(applyHeroHeight, 150);
    });
    console.log(PREFIX + ' активний (visualViewport-фікс висоти hero)');
  });
})();
