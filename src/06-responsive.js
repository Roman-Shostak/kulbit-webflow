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

    // — Виставити стан сайту за поточною орієнтацією
    const apply = () => {
      if (mql.matches) {
        // landscape-телефон: попап ON, fullpage OFF, відео пауза
        popup.style.display = 'flex';
        if (app.observer) app.observer.disable();
        (app.videos || []).forEach((rec) => rec.hide());
        console.log('[Kulbit-Responsive] landscape-телефон: попап ON, fullpage OFF');
      } else {
        // портрет / не-телефон: попап OFF, fullpage ON
        popup.style.display = 'none';
        if (app.observer) app.observer.enable();
        // якщо сторінку відкрили в landscape — hero міг не побудуватись; добудовуємо
        const hero = app.sections && app.sections[0];
        if (hero && !hero.isTabletHero && !hero.isAnimated && app.registerAnimations) {
          app.registerAnimations();
          console.log('[Kulbit-Responsive] hero добудовано на повернення в портрет');
        }
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
