// ====================================================================
// 08-video.js — Vimeo фонове відео в hero: плеєр + cover + перемикач звуку
//
//   Розмітка (атрибути, у дусі ADR-007):
//   • контейнер відео:  [data-kulbit-video] + data-kulbit-video-id="<число>"
//                       + data-kulbit-video-hash="<хеш>" (для unlisted)
//   • кнопка звуку:     [data-kulbit-sound] з іконками
//                       .icon-24 (динамік) та .icon-24.is-mute (перекреслена)
//
//   Скейл відео (1.3→1) робить рушій таймлайну (03-sections.js) за атрибутами
//   data-kulbit-scale / -scale-from на тому ж контейнері. Тут — лише плеєр+звук.
//   Vimeo грає через <iframe>, тож порожню заглушку <video> прибираємо.
// ====================================================================

console.log('[Kulbit] 08-video.js завантажено');

// ## — Фонове Vimeo-відео
(() => {
  const ASPECT = 16 / 9; // співвідношення відео (для cover-розрахунку)

  // 01 — cover: розмір iframe так, щоб 16:9 ПОКРИВАЛО контейнер; зайве ховає overflow:hidden.
  //      Рахуємо від контейнера (не вьюпорта) — тримається і під час scale-анімації.
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
    const id = box.getAttribute('data-kulbit-video-id');
    const hash = box.getAttribute('data-kulbit-video-hash');
    if (!id) {
      console.error('[Kulbit-Video] ❌ немає data-kulbit-video-id на', box);
      return null;
    }

    // Контейнер — система координат для iframe + ховає overflow
    box.style.position = 'relative';
    box.style.overflow = 'hidden';

    // Прибираємо порожню заглушку <video> (Vimeo працює через <iframe>)
    const stub = box.querySelector('video');
    if (stub) stub.remove();

    // unlisted-відео: хеш має бути В ШЛЯХУ URL — /{id}/{hash}
    const url = hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
    const player = new Vimeo.Player(box, {
      url,
      background: true, // autoplay + loop + muted + без UI
      dnt: true,        // do-not-track
      responsive: false
    });

    player.ready().then(() => {
      const iframe = box.querySelector('iframe');
      if (iframe) {
        applyCover(box, iframe);
        // Перерахунок cover при зміні розміру контейнера (ресайз вікна)
        new ResizeObserver(() => applyCover(box, iframe)).observe(box);
      }
      console.log('[Kulbit-Video] ✅ плеєр готовий (cover активний)');
    }).catch((e) => console.error('[Kulbit-Video] ❌ помилка завантаження:', e));

    // Кнопка звуку — старт muted (перекреслена іконка), клік перемикає
    const btn = document.querySelector('[data-kulbit-sound]');
    if (btn) {
      setSoundIcons(btn, true, false); // початковий стан без анімації
      btn.addEventListener('click', () => {
        player.getMuted().then((m) => player.setMuted(!m).then(() => {
          const muted = !m;
          setSoundIcons(btn, muted, true);
          console.log('[Kulbit-Video] 🔊 muted →', muted);
        }));
      });
    } else {
      console.warn('[Kulbit-Video] кнопку [data-kulbit-sound] не знайдено');
    }

    return player;
  };

  // 04 — Старт після готовності DOM
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
