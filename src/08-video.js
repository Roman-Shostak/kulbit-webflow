// ====================================================================
// 08-video.js — Vimeo фонове відео: cover + перемикач звуку + пауза/звук по видимості
//
//   Відео ЗАВЖДИ вставляється як <iframe> у Webflow Embed (НЕ через JS).
//   Розмітка:
//   • контейнер: [data-kulbit-video], усередині — <iframe> Vimeo;
//     у src ОБОВ'ЯЗКОВО &background=1 (autoplay + loop + muted + без UI),
//     unlisted-відео → ?h=<хеш> у src.
//   • кнопка звуку (опційно, у тій же секції): [data-kulbit-sound] з іконками
//     .icon-24 (динамік) та .icon-24.is-mute (перекреслена).
//
//   Пауза/звук по видимості: відео грає лише коли його секція поточна (не накрита
//   стекінгом). Накрилось → пауза + мут; повернулось → грає + звук як був (намір
//   користувача soundOn). updateVideoVisibility() кличе навігація (03-sections.js).
// ====================================================================

console.log('[Kulbit] 08-video.js завантажено');

// ## — Фонове Vimeo-відео
(() => {
  const ASPECT = 16 / 9; // співвідношення відео (для cover-розрахунку)

  // 01 — cover: розмір iframe так, щоб 16:9 ПОКРИВАЛО контейнер; зайве ховає overflow:hidden.
  //      Рахуємо від контейнера (не вьюпорта) — тримається й під час scale/16:9-анімації.
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

  // 03 — Ініціалізація одного відео-блоку. Повертає запис { player, sectionIndex, show, hide }.
  const initVideo = (box) => {
    box.style.position = 'relative';
    box.style.overflow = 'hidden';

    let iframe = box.querySelector('iframe');
    if (!iframe) {
      console.error('[Kulbit-Video] ❌ у [data-kulbit-video] немає <iframe> — встав ембед Vimeo з &background=1');
      return null;
    }
    // Витягуємо iframe зі стандартної padding-обгортки Vimeo (56.25%), якщо є
    if (iframe.parentElement && iframe.parentElement !== box) {
      const wrap = iframe.parentElement;
      box.appendChild(iframe);
      wrap.remove();
    }

    const player = new Vimeo.Player(iframe);

    player.ready().then(() => {
      applyCover(box, iframe);
      new ResizeObserver(() => applyCover(box, iframe)).observe(box);
      console.log('[Kulbit-Video] ✅ плеєр готовий (cover активний)');
    }).catch((e) => console.error('[Kulbit-Video] ❌ помилка завантаження:', e));

    let soundOn = false; // намір користувача (старт muted; autoplay вимагає muted)
    const sectionEl = box.closest('[data-kulbit-section]');
    const sectionIndex = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;

    // Кнопка звуку (у тій же секції; може бути відсутня)
    const btn = (sectionEl || document).querySelector('[data-kulbit-sound]');
    if (btn) {
      setSoundIcons(btn, true, false); // старт muted (перекреслена)
      btn.addEventListener('click', () => {
        soundOn = !soundOn;
        player.setMuted(!soundOn);
        setSoundIcons(btn, !soundOn, true);
        console.log('[Kulbit-Video] звук:', soundOn);
      });
    }

    return {
      player, sectionIndex,
      show: () => { player.play(); player.setMuted(!soundOn); }, // грати + звук як хотів користувач
      hide: () => { player.pause(); player.setMuted(true); }     // пауза + примусовий мут
    };
  };

  // 04 — Пауза/звук по видимості: відео активне лише коли його секція поточна.
  //      Кличе навігація (03-sections.js) при зміні currentSectionIndex.
  window.KulbitApp = window.KulbitApp || {};
  window.KulbitApp.updateVideoVisibility = () => {
    const app = window.KulbitApp;
    (app.videos || []).forEach((rec) => {
      if (rec.sectionIndex === app.currentSectionIndex) rec.show();
      else rec.hide();
    });
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
    const app = window.KulbitApp = window.KulbitApp || {};
    app.videos = app.videos || [];
    boxes.forEach((box) => {
      const rec = initVideo(box);
      if (rec) app.videos.push(rec);
    });
  });
})();
