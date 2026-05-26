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
    const inFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

    const apply = () => {
      if (inFullscreen()) {
        // відео на весь екран (можливо в landscape — orientation lock у 10-project-video.js):
        //   попап НЕ показуємо, навігацію вимикаємо, відео НЕ паузимо (його дивляться).
        app.landscapeBlocked = false;
        popup.style.display = 'none';
        if (app.observer) app.observer.disable();
        console.log('[Kulbit-Responsive] fullscreen — попап OFF (відео на весь екран)');
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

    mql.addEventListener('change', apply);
    // Вхід/вихід fullscreen теж перевизначає стан (фуллскрін у landscape не має тригерити попап)
    document.addEventListener('fullscreenchange', apply);
    document.addEventListener('webkitfullscreenchange', apply);
    // Початковий стан — наступним тіком, щоб 08-video.js встиг заповнити app.videos
    setTimeout(apply, 0);
    console.log('[Kulbit-Responsive] детект landscape активний (max-height', maxH + 'px)');
  });
})();
