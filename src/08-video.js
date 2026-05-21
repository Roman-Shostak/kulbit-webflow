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
