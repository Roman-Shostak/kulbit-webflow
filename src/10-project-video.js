// ====================================================================
// 10-project-video.js — Vimeo-плеєр проєктів із кастомними контролами + cover
//
//   Відкрите відео-портфоліо (секція is-projects): кероване користувачем
//   (НЕ background-autoplay, на відміну від hero у 08-video.js). Усе керування —
//   власні елементи, GSAP лише для плавних дрібниць (іконки, попап).
//
//   Розмітка (усе всередині кореня [data-kulbit-project-video] = .projects-video-wrapper):
//   • [data-kulbit-project-video] — КОРІНЬ (relative; overflow:hidden), усередині <iframe> Vimeo
//     (у src: &controls=0 — рідні контроли off; unlisted → ?h=<хеш>)
//   • [data-kulbit-poster]   — постер (показ до старту; absolute, inset:0, cover)
//   • [data-kulbit-play]     — велика центральна кнопка старту
//   • [data-kulbit-controls] — панель (display:none дефолт; JS показує після старту)
//   •   [data-kulbit-toggle] із [data-kulbit-icon-play] / [data-kulbit-icon-pause]
//   •   [data-kulbit-time-current] / [data-kulbit-time-total] — таймери (M:SS)
//   •   [data-kulbit-seek] із [data-kulbit-seek-fill] (прогрес) + [data-kulbit-buffer] (завантажено)
//   •   [data-kulbit-volume] із [data-kulbit-icon-volume] / [data-kulbit-icon-mute],
//       [data-kulbit-volume-popup] > [data-kulbit-volume-track] > [data-kulbit-volume-fill]
//   •   [data-kulbit-fullscreen] — розгортання кореня нативним Fullscreen API
//
//   Пауза за кадром: відео реєструється в app.videos із hide()=пауза (show — no-op,
//   бо плей лише вручну). Навігація (03-sections.js) кличе hideOtherVideos на
//   завершенні переходу → звук не грає, коли секцію накрито стекінгом / у landscape.
// ====================================================================

console.log('[Kulbit] 10-project-video.js завантажено');

// ## — Vimeo-плеєр проєктів
(() => {
  const ASPECT = 16 / 9;     // співвідношення відео для cover-розрахунку
  const ICON_DUR = 0.15;     // перемикання іконок (play/pause, volume/mute)
  const POPUP_DUR = 0.2;     // поява/зникання попапа гучності
  const FADE_DUR = 0.3;      // згасання постера/кнопки на старті
  const COMPACT_MAX = 991;   // ≤ цього (tablet/mobile): fullscreen через Vimeo SDK + кнопка звуку = мут

  // На tablet/mobile (≤991): div-fullscreen не працює на iOS → беремо нативний fullscreen відео
  //   через Vimeo SDK; повзунок гучності iOS ігнорує → кнопка звуку стає простою мут-кнопкою.
  const isCompact = () => window.innerWidth <= COMPACT_MAX;

  // 01 — cover: розмір iframe так, щоб 16:9 ПОКРИВАЛО корінь; зайве ховає overflow:hidden.
  //      Рахуємо від кореня (не вьюпорта) — тримається й у fullscreen.
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

  // 02 — секунди → M:SS
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' + sec : '' + sec);
  };

  // 03 — Ініціалізація одного відео-блоку. Повертає запис { player, sectionIndex, show, hide }.
  const initProjectVideo = (root) => {
    root.style.position = 'relative';
    root.style.overflow = 'hidden';

    const iframe = root.querySelector('iframe');
    if (!iframe) {
      console.error('[Kulbit-PV] ❌ у [data-kulbit-project-video] немає <iframe> — встав ембед Vimeo з &controls=0');
      return null;
    }
    // Vimeo-iframe (cross-origin) перехоплює wheel → Observer не отримує скрол над відео.
    //   Контроли в нас власні (поверх відео), тож iframe-у події миші не потрібні: вимикаємо
    //   pointer-events, щоб колесо «проходило наскрізь» до Observer (кнопки лишаються клікабельні).
    iframe.style.pointerEvents = 'none';

    const poster      = root.querySelector('[data-kulbit-poster]');
    const bigPlay     = root.querySelector('[data-kulbit-play]');
    const controls    = root.querySelector('[data-kulbit-controls]');
    const toggle      = root.querySelector('[data-kulbit-toggle]');
    const iconPlay    = root.querySelector('[data-kulbit-icon-play]');
    const iconPause   = root.querySelector('[data-kulbit-icon-pause]');
    const timeCurrent = root.querySelector('[data-kulbit-time-current]');
    const timeTotal   = root.querySelector('[data-kulbit-time-total]');
    const seek        = root.querySelector('[data-kulbit-seek]');
    const seekFill    = root.querySelector('[data-kulbit-seek-fill]');
    const buffer      = root.querySelector('[data-kulbit-buffer]');
    const volume      = root.querySelector('[data-kulbit-volume]');
    const popup       = root.querySelector('[data-kulbit-volume-popup]');
    const track       = root.querySelector('[data-kulbit-volume-track]');
    const fill        = root.querySelector('[data-kulbit-volume-fill]');
    const iconVolume  = root.querySelector('[data-kulbit-icon-volume]');
    const iconMute    = root.querySelector('[data-kulbit-icon-mute]');
    const fsBtn       = root.querySelector('[data-kulbit-fullscreen]');

    const player = new Vimeo.Player(iframe);

    let duration = 0;
    let seekDrag = false, seekFrac = 0; // перетяг доріжки
    let volDrag = false;                // перетяг повзунка гучності
    let popupOpen = false;

    // --- іконка play/pause за реальним станом плеєра ---
    const setToggleIcon = (playing) => {
      if (iconPause) gsap.to(iconPause, { autoAlpha: playing ? 1 : 0, duration: ICON_DUR });
      if (iconPlay)  gsap.to(iconPlay,  { autoAlpha: playing ? 0 : 1, duration: ICON_DUR });
    };

    // --- прогрес + поточний час за часткою 0..1 ---
    const renderProgress = (frac) => {
      if (seekFill) seekFill.style.width = (frac * 100) + '%';
      if (timeCurrent) timeCurrent.textContent = fmt(frac * duration);
    };
    const seekFracFromX = (clientX) => {
      const rect = seek.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };

    // --- гучність (вертикальний повзунок: верх = більше) ---
    const setVolumeIcon = (v) => {
      const muted = v <= 0.001;
      if (iconVolume) gsap.to(iconVolume, { autoAlpha: muted ? 0 : 1, duration: ICON_DUR });
      if (iconMute)   gsap.to(iconMute,   { autoAlpha: muted ? 1 : 0, duration: ICON_DUR });
    };
    const applyVolume = (v) => {
      if (fill) fill.style.height = (v * 100) + '%';
      player.setVolume(v);
      setVolumeIcon(v);
    };
    const volFracFromY = (clientY) => {
      const rect = track.getBoundingClientRect();
      return Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height));
    };

    // --- плавний попап гучності (fade + легкий під'їзд) ---
    const openPopup = () => {
      popupOpen = true;
      if (!popup) return;
      gsap.killTweensOf(popup);
      popup.style.display = 'flex';
      gsap.fromTo(popup, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: POPUP_DUR, ease: 'power2.out' });
    };
    const closePopup = (instant) => {
      popupOpen = false;
      if (!popup) return;
      gsap.killTweensOf(popup);
      if (instant) { gsap.set(popup, { autoAlpha: 0, y: 8 }); popup.style.display = 'none'; return; }
      gsap.to(popup, { autoAlpha: 0, y: 8, duration: POPUP_DUR, ease: 'power2.in',
        onComplete: () => { if (!popupOpen) popup.style.display = 'none'; } }); // guard від гонки відкр/закр
    };

    // --- fullscreen (корінь розгортається; контроли лишаються, бо вони його діти) ---
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const enterFs = () => {
      // tablet/mobile: нативний fullscreen відео через Vimeo SDK (div-fullscreen не працює на iOS;
      //   вихід — нативною кнопкою плеєра). Desktop: розгортаємо корінь із власними контролами.
      if (isCompact() && player.requestFullscreen) {
        player.requestFullscreen().catch((e) => console.warn('[Kulbit-PV] SDK fullscreen відхилено:', e && e.name));
        return;
      }
      if (root.requestFullscreen) root.requestFullscreen();
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
      else console.warn('[Kulbit-PV] fullscreen API недоступне на цьому пристрої');
    };
    const exitFs = () => {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    };

    // --- стартовий стан: постер + велика кнопка видимі, панель схована ---
    const showInitial = () => {
      if (poster)  gsap.set(poster,  { autoAlpha: 1 });
      if (bigPlay) gsap.set(bigPlay, { autoAlpha: 1 });
      if (controls) controls.style.display = 'none';
      setToggleIcon(false);
      closePopup(true);
      if (timeCurrent) timeCurrent.textContent = '0:00';
      if (seekFill) seekFill.style.width = '0%';
      if (buffer) buffer.style.width = '0%';
    };

    // --- перший старт: ховаємо постер + кнопку, показуємо панель ---
    const startPlayback = () => {
      if (poster)  gsap.to(poster,  { autoAlpha: 0, duration: FADE_DUR });
      if (bigPlay) gsap.to(bigPlay, { autoAlpha: 0, duration: FADE_DUR });
      if (controls) controls.style.display = 'flex';
      // play() ПЕРШИМ -- стартує надійно (muted-стан embed дозволено), ПОТІМ знімаємо mute.
      //   setMuted(false) ДО play ламав запуск на iOS (unmuted-play у gesture відхилявся).
      //   Один клік по data-kulbit-play = старт + звук. Іконку оновить подія volumechange.
      player.play()
        .then(() => player.setMuted(false))
        .catch((e) => console.warn('[Kulbit-PV] play:', e && e.name));
    };

    // --- готовність: cover + ресайз-спостерігач + тривалість + початкова гучність ---
    player.ready().then(() => {
      applyCover(root, iframe);
      new ResizeObserver(() => applyCover(root, iframe)).observe(root);
      showInitial();
      return player.getDuration();
    }).then((d) => {
      duration = d;
      if (timeTotal) timeTotal.textContent = fmt(d);
      return player.getVolume();
    }).then((v) => {
      if (fill) fill.style.height = (v * 100) + '%';
      setVolumeIcon(v);
      console.log('[Kulbit-PV] ✅ плеєр готовий (cover активний)');
    }).catch((e) => console.error('[Kulbit-PV] ❌ помилка завантаження:', e));

    // --- play / pause ---
    if (bigPlay) bigPlay.addEventListener('click', startPlayback);
    if (toggle) toggle.addEventListener('click', () => {
      player.getPaused().then((paused) => { if (paused) player.play(); else player.pause(); });
    });

    // --- перемотка: клік або перетяг по доріжці ---
    if (seek) {
      seek.addEventListener('pointerdown', (e) => {
        seekDrag = true; seekFrac = seekFracFromX(e.clientX);
        renderProgress(seekFrac); seek.setPointerCapture(e.pointerId);
      });
      seek.addEventListener('pointermove', (e) => {
        if (!seekDrag) return; seekFrac = seekFracFromX(e.clientX); renderProgress(seekFrac);
      });
      seek.addEventListener('pointerup', () => {
        if (!seekDrag) return; seekDrag = false; player.setCurrentTime(seekFrac * duration);
      });
    }

    // --- гучність: tablet/mobile — проста мут-кнопка; desktop — попап із повзунком ---
    if (volume) volume.addEventListener('click', (e) => {
      // tablet/mobile: тільки mute/unmute (рівень гучності iOS ігнорує, повзунок безсенсовий)
      if (isCompact()) {
        player.getMuted().then((m) => { player.setMuted(!m); setVolumeIcon(!m ? 0 : 1); });
        return;
      }
      if (popup && popup.contains(e.target)) return; // клік усередині попапа не перемикає
      if (popupOpen) closePopup(); else openPopup();
    });
    document.addEventListener('click', (e) => {
      if (popupOpen && volume && !volume.contains(e.target)) closePopup();
    });

    // --- гучність: вертикальний повзунок (клік/перетяг) ---
    if (track) {
      track.addEventListener('pointerdown', (e) => {
        volDrag = true; applyVolume(volFracFromY(e.clientY)); track.setPointerCapture(e.pointerId);
      });
      track.addEventListener('pointermove', (e) => {
        if (!volDrag) return; applyVolume(volFracFromY(e.clientY));
      });
      track.addEventListener('pointerup', () => { volDrag = false; });
    }

    // --- fullscreen ---
    if (fsBtn) fsBtn.addEventListener('click', () => { if (fsElement()) exitFs(); else enterFs(); });
    document.addEventListener('fullscreenchange', () => applyCover(root, iframe));
    document.addEventListener('webkitfullscreenchange', () => applyCover(root, iframe));

    // --- синхронізація UI з реальним станом плеєра ---
    player.on('play',  () => setToggleIcon(true));
    player.on('pause', () => setToggleIcon(false));
    player.on('ended', () => setToggleIcon(false));
    // Іконка звуку — завжди за РЕАЛЬНИМ станом (а не за припущенням): muted → mute-іконка, інакше рівень
    player.on('volumechange', (data) => {
      player.getMuted().then((m) => setVolumeIcon(m ? 0 : (data && data.volume != null ? data.volume : 1)));
    });
    player.on('timeupdate', (data) => {
      if (seekDrag) return;
      if (data.duration) duration = data.duration;
      renderProgress(data.percent || 0); // percent = зіграна частка
    });
    player.on('progress', (data) => {
      if (buffer) buffer.style.width = ((data.percent || 0) * 100) + '%'; // percent = завантажена частка
    });

    // Запис для пауза-за-кадром (08-video.js хазяйнує app.videos):
    //   hide — пауза (секцію накрито / landscape); show — no-op (плей лише вручну).
    const sectionEl = root.closest('[data-kulbit-section]');
    const sectionIndex = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;
    return {
      player, sectionIndex,
      show: () => {},                 // кероване користувачем — НЕ автоплей
      hide: () => player.pause()      // за кадром — пауза (без звуку off-screen)
    };
  };

  // 04 — Старт після готовності DOM
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Vimeo === 'undefined') {
      console.error('[Kulbit-PV] ❌ Vimeo Player SDK не підключено (player.js перед бандлом)');
      return;
    }
    const roots = document.querySelectorAll('[data-kulbit-project-video]');
    if (!roots.length) {
      console.log('[Kulbit-PV] відео-блоків [data-kulbit-project-video] немає');
      return;
    }
    const app = window.KulbitApp = window.KulbitApp || {};
    app.videos = app.videos || [];
    roots.forEach((root) => {
      const rec = initProjectVideo(root);
      if (rec) app.videos.push(rec);
    });
  });
})();
