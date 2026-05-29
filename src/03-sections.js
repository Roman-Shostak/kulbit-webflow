// ====================================================================
// 03-sections.js — Секції + кроки: реєстрація з DOM, СТЕКІНГ-переходи, покрокові анімації
//                  (методи додаються до KulbitApp з 02-app-core.js)
//
//   Навігація — СТЕКІНГ (ADR-010): секції накладаються одна на одну.
//   Два типи покрокових секцій (детектяться з розмітки):
//   • reveal-кроки  — елементи [data-kulbit-step] (дефолтний показ autoAlpha+y)
//   • кастомний таймлайн — елементи з [data-kulbit-y] / [data-kulbit-scale] /
//     [data-kulbit-fade] складаються в один GSAP-таймлайн (ADR-009).
// ====================================================================

console.log('[Kulbit] 03-sections.js завантажено');

// ## — Методи роботи з секціями, стекінгом, кроками та кастомними таймлайнами
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // Селектор анімованих елементів кастомного таймлайну
  const ANIM_SELECTOR = '[data-kulbit-y],[data-kulbit-scale],[data-kulbit-fade]';
  const num = (el, attr, fallback) => {
    const v = parseFloat(el.getAttribute(attr));
    return Number.isNaN(v) ? fallback : v;
  };

  // 01 — Реєстрація секцій з DOM. Індекс проставляє JS з DOM-порядку (reorder-safe).
  app.registerSections = () => {
    const els = document.querySelectorAll('[data-kulbit-section]');
    app.sections = Array.from(els).map((el, index) => {
      el.setAttribute('data-section-index', index);
      return {
        el, index,
        isFooter: el.classList.contains('footer'),
        steps: [], isStepped: false,        // reveal-кроки
        timeline: null, isAnimated: false,  // кастомний таймлайн desktop (ADR-009)
        tabletTL: null, isTabletHero: false, // спец таблет-hero (ADR-011)
        oc: null, isOurClients: false,       // спец секція is-our-clients (ADR-013)
        pv: null, isProjects: false          // спец секція is-projects: свап відео (ADR-015)
      };
    });

    if (!app.sections.length) {
      console.error('[Kulbit-Sections] ❌ Не знайдено секцій [data-kulbit-section]');
      return;
    }
    console.log('[Kulbit-Sections] зареєстровано секцій:', app.sections.length);
  };

  // 02 — Реєстрація reveal-кроків: для кожної секції збираємо [data-kulbit-step] у DOM-порядку.
  //      Покроковість детектиться З РОЗМІТКИ, не зі списку в JS.
  app.registerSteps = () => {
    app.sections.forEach((s) => {
      const stepEls = s.el.querySelectorAll('[data-kulbit-step]');
      stepEls.forEach((el, i) => el.setAttribute('data-step-index', i));
      s.steps = Array.from(stepEls);
      s.isStepped = s.steps.length > 0;
      if (s.isStepped) {
        app.resetSteps(s, false); // на старті всі кроки сховані
        console.log(`[Kulbit-Steps] секція ${s.index}: reveal-кроки, кроків: ${s.steps.length}`);
      }
    });
  };

  // 03 — Реєстрація анімацій hero за брейкпоінтом — ДИНАМІЧНО через gsap.matchMedia (ADR-011/012).
  //      Зміна ширини/орієнтації перебудовує hero БЕЗ reload: на вхід у брейкпоінт — будуємо,
  //      на вихід — GSAP сам ревертить таймлайни/сети контексту, ми чистимо стан (teardownHero).
  //      Desktop (≥992): атрибутні таймлайни (ADR-009).
  //      Tablet (768-991) ТА Mobile (≤479): та сама спец hero-хореографія (buildTabletHero),
  //        читає ті самі -tablet атрибути; геометрія (16:9/кнопка/накриття) рахується динамічно.
  //      480-767 («Mobile landscape» у Webflow): діапазон попапа «поверни екран» — hero не будуємо.
  //      На кожній зміні брейкпоінта повертаємось на hero (resetHeroState) — стан стартує чистим.
  app.registerAnimations = () => {
    if (app.mm) app.mm.kill();         // якщо колись перевикликають — прибрати старий matchMedia
    app.mm = gsap.matchMedia();

    app.mm.add('(min-width: 992px)', () => {              // desktop ≥992
      app.resetHeroState();
      app.buildDesktopAnimations();
      app.buildOurClients('desktop');                    // is-our-clients (ADR-013)
      app.buildProjects('desktop');                      // is-projects: свап відео (ADR-015, поки лише desktop)
      app.buildHSwipe('desktop');                        // is-our-services: горизонтальний свап карток
      app.buildWorkingProcess('desktop');                // is-working-process: stack-cards (десktop - горизонт.)
      app.restoreSection();                              // персистентність: відновити позицію (reload/перебудова)
      return () => app.teardownHero();
    });
    app.mm.add('(min-width: 768px) and (max-width: 991px)', () => {       // tablet 768-991
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('tablet');                     // is-our-clients (ADR-013, таблет)
      app.buildProjects('tablet');                       // is-projects: свап вікном 3 (ADR-016 re-approach)
      app.buildHSwipe('tablet');                         // is-our-services: горизонтальний свап карток
      app.buildWorkingProcess('tablet');                 // is-working-process: stack-cards (Z-stack)
      app.restoreSection();                              // персистентність: відновити позицію
      return () => app.teardownHero();
    });
    app.mm.add('(max-width: 479px)', () => {             // mobile-портрет ≤479
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('mobile');                     // is-our-clients (ADR-013, мобілка: shiftN [2,1,2])
      app.buildProjects('mobile');                       // is-projects: свап вікном 3 (ADR-016 re-approach)
      app.buildHSwipe('mobile');                         // is-our-services: горизонтальний свап карток
      app.buildWorkingProcess('mobile');                 // is-working-process: stack-cards (Z-stack)
      app.restoreSection();                              // персистентність: відновити позицію
      return () => app.teardownHero();
    });
    // 480-767 — горизонтальна мобілка: hero не будуємо (попап landscape, 06-responsive.js)

    console.log('[Kulbit-Anim] matchMedia активний (брейкпоінти 992/768/479, динамічна перебудова)');
  };

  // 03-0 — Чистий стан перед побудовою hero (старт кожного брейкпоінта з hero, крок 0).
  app.resetHeroState = () => {
    app.currentSectionIndex = 0;
    app.currentStep = 0;
    app.isAnimating = false;
    app.applyStackingPositions();                 // дискретні позиції стекінгу під currentSectionIndex=0
    if (app.updateVideoVisibility) app.updateVideoVisibility();
  };

  // 03-0b — Прибирання hero при виході з брейкпоінта. GSAP САМ ревертить таймлайни/сети контексту;
  //         нам лишається скинути наші посилання/прапорці (новий контекст усе перебудує).
  app.teardownHero = () => {
    if (app._heroVidCleanup) { app._heroVidCleanup(); app._heroVidCleanup = null; } // зняти слухач ресайзу відео
    app.sections.forEach((s) => {
      s.timeline = null; s.isAnimated = false;
      s.tabletTL = null; s.isTabletHero = false;
      if (s.oc && s.oc.dispose) s.oc.dispose(); // прибрати IntersectionObserver (ADR-013)
      s.oc = null; s.isOurClients = false;
      if (s.pv && s.pv.dispose) s.pv.dispose(); // прибрати свап-стан is-projects (ADR-015)
      s.pv = null; s.isProjects = false;
      if (s.hswipe && s.hswipe.dispose) s.hswipe.dispose(); // прибрати свап-стан is-our-services
      s.hswipe = null; s.isHSwipe = false;
      if (s.wp && s.wp.dispose) s.wp.dispose();             // прибрати свап-стан is-working-process
      s.wp = null; s.isWP = false;
    });
    console.log('[Kulbit-Anim] teardown hero (зміна брейкпоінта)');
  };

  // 03a — Desktop: атрибутні таймлайни по секціях (ADR-009).
  //       Елементи прив'язуємо до секції через closest; ті, що поза секціями (header) → hero.
  app.buildDesktopAnimations = () => {
    const animEls = document.querySelectorAll(ANIM_SELECTOR);
    if (!animEls.length) return;

    const bySection = new Map(); // індекс секції → масив елементів
    animEls.forEach((el) => {
      const sectionEl = el.closest('[data-kulbit-section]');
      const idx = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;
      if (!bySection.has(idx)) bySection.set(idx, []);
      bySection.get(idx).push(el);
    });

    bySection.forEach((els, idx) => {
      const section = app.sections[idx];
      if (!section) return;
      section.timeline = app.buildSectionTimeline(els);
      section.isAnimated = true;
      console.log(`[Kulbit-Anim] desktop секція ${idx}: таймлайн, елементів: ${els.length}`);
    });
  };

  // 03b — Спец hero (ADR-011) для Tablet (768-991) ТА Mobile (≤479) — та сама хореографія.
  //   3 кроки; останній сплітається зі стекінгом секції 1.
  //   крок1: -tablet атрибути (контент вниз+згас, header вгору, відео scale 1.3→1);
  //   крок2: відео .hero-video → 16:9 (height) + секція 2 наповзає під 16:9 + кнопка в центр 16:9;
  //   крок3: секція 2 повністю накриває (= перехід на секцію 1).
  app.buildTabletHero = () => {
    const hero = app.sections[0];
    const section2 = app.sections[1] && app.sections[1].el;
    if (!hero || !section2) { console.warn('[Kulbit-Tablet] немає hero / секції 2'); return; }
    const heroVideo = hero.el.querySelector('.hero-video');
    if (!heroVideo) { console.warn('[Kulbit-Tablet] немає .hero-video'); return; }
    const btn = hero.el.querySelector('.hero-video-button');

    const STEP = app.config.stepDuration, SCROLL = app.config.scrollDuration, EASE = app.config.ease;
    const SUF = '-tablet';
    const has = (el, n) => el.hasAttribute('data-kulbit-' + n + SUF);
    const v = (el, n, fb) => num(el, 'data-kulbit-' + n + SUF, fb);
    const sel = `[data-kulbit-y${SUF}],[data-kulbit-scale${SUF}],[data-kulbit-fade${SUF}]`;
    const header = document.querySelector('[data-kulbit-header]');
    const els = [...hero.el.querySelectorAll(sel)];
    if (header && header.matches(sel)) els.push(header);

    // Початкові стани (крок 0)
    els.forEach((el) => {
      const s = {};
      if (has(el, 'y')) s.yPercent = 0;
      if (has(el, 'scale')) { s.scale = v(el, 'scale-from', 1); s.transformOrigin = '50% 50%'; }
      if (has(el, 'fade')) s.autoAlpha = 1;
      gsap.set(el, s);
    });
    // Висота hero-відео (крок 0 = на весь екран) від РЕАЛЬНОГО вьюпорта (як зовнішній hero-vh-fix),
    //   а не clientHeight: при повороті buildTabletHero спрацьовує ДО того, як hero-vh-fix виставить
    //   фінальну висоту секції → відео морозилось на проміжній/landscape висоті.
    const fullVideoH = () => (window.visualViewport && window.visualViewport.height) ||
                             (app.wrapper ? app.wrapper.clientHeight : window.innerHeight);
    const syncHeroVideoFull = () => { // оновлюємо ЛИШЕ коли hero повний (крок 0) — не ламаємо 16:9 (крок 2)
      if (app.currentSectionIndex === 0 && app.currentStep === 0) gsap.set(heroVideo, { height: fullVideoH() });
    };
    gsap.set(heroVideo, { bottom: 'auto', height: fullVideoH() });
    gsap.set(section2, { yPercent: 100 });
    if (btn) gsap.set(btn, { y: 0 });

    // Геометрія 16:9. ВАЖЛИВО: висоти беремо з РЕНДЕРУ елементів, а не з window.innerHeight.
    //   На мобілці адресний бар робить 100vh (CSS) != innerHeight (JS): якщо рахувати
    //   зсув секції 2 від innerHeight, а сама секція має height:100vh — між відео та
    //   секцією зʼявляється смуга (видно фон сайту). Тож partial рахуємо від offsetHeight
    //   самої секції 2 → top секції стає рівно під 16:9-відео.
    const video16h = Math.round(heroVideo.clientWidth * 9 / 16);
    const partial = (video16h / section2.offsetHeight) * 100;
    // Видима висота = фіксований вьюпорт (#smooth-wrapper), а не innerHeight/100vh
    const visibleH = app.wrapper ? app.wrapper.clientHeight : window.innerHeight;
    // Центр кнопки: крок1 — центр видимого екрана; крок2 — центр 16:9-смуги (top-anchored)
    let btnYScreen = 0, btnY16 = 0;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const btnCenter = r.top + r.height / 2;
      btnYScreen = (visibleH / 2) - btnCenter;  // крок1
      btnY16 = (video16h / 2) - btnCenter;       // крок2
    }

    // Таймлайн із мітками
    const tl = gsap.timeline({ paused: true });
    els.forEach((el) => { // КРОК 1 (усе разом)
      const to = { duration: STEP, ease: EASE };
      if (has(el, 'y')) to.yPercent = v(el, 'y', 0);
      if (has(el, 'scale')) to.scale = v(el, 'scale', 1);
      if (has(el, 'fade')) to.autoAlpha = v(el, 'fade', 0);
      tl.to(el, to, 0);
    });
    if (btn) tl.to(btn, { y: btnYScreen, duration: STEP, ease: EASE }, 0); // КРОК 1: кнопка в центр екрана
    tl.addLabel('s1');
    tl.to(heroVideo, { height: video16h, duration: STEP, ease: EASE }, 's1'); // КРОК 2
    tl.to(section2, { yPercent: partial, duration: STEP, ease: EASE }, 's1');
    if (btn) tl.to(btn, { y: btnY16, duration: STEP, ease: EASE }, 's1'); // КРОК 2: кнопка в центр 16:9
    tl.addLabel('s2');
    tl.to(section2, { yPercent: 0, duration: SCROLL, ease: EASE }, 's2'); // КРОК 3 (накриття)
    tl.addLabel('s3');

    hero.tabletTL = tl;
    hero.isTabletHero = true;
    app.currentStep = 0;

    // Пересинхронізація висоти відео після повороту/зміни вьюпорта (hero-vh-fix виставляє висоту
    //   секції асинхронно). Знімаємо попередній слухач (buildTabletHero перебудовується), ставимо новий.
    if (app._heroVidCleanup) app._heroVidCleanup();
    let heroVidTimer;
    const onHeroResize = () => { clearTimeout(heroVidTimer); heroVidTimer = setTimeout(syncHeroVideoFull, 200); };
    window.addEventListener('resize', onHeroResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onHeroResize);
    app._heroVidCleanup = () => {
      clearTimeout(heroVidTimer);
      window.removeEventListener('resize', onHeroResize);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', onHeroResize);
    };
    setTimeout(syncHeroVideoFull, 250); // одразу по побудові — упіймати фінальну висоту від hero-vh-fix

    console.log('[Kulbit-Tablet] hero готовий: 16:9', video16h, 'partial', Math.round(partial));
  };

  // 03c — Таблет-hero крокування (ADR-011). Повертає true, якщо жест оброблено.
  app.tabletHeroStep = (dir) => {
    const hero = app.sections[0];
    const tl = hero.tabletTL;
    const labels = [0, 's1', 's2', 's3'], MAX = 3;
    const idx = app.currentSectionIndex;

    if (idx === 0) { // на hero — крокуємо таймлайн
      if (dir > 0 && app.currentStep < MAX) {
        app.isAnimating = true;
        const ns = app.currentStep + 1;
        tl.tweenTo(labels[ns], { onComplete: () => {
          app.isAnimating = false;
          if (ns === MAX) {
            app.currentSectionIndex = 1; app.currentStep = 0;
            app.persistSection(); // зберегти позицію (hero → секція 1 іде в обхід goToSection)
            if (app.updateVideoVisibility) app.updateVideoVisibility();
            const s1 = app.sections[1]; // секція 1 (is-our-clients) накрила — запускаємо її появу
            if (s1 && s1.isOurClients && s1.oc) s1.oc.enter();
          } else app.currentStep = ns;
        } });
      } else if (dir < 0 && app.currentStep > 0) {
        app.isAnimating = true;
        const ns = app.currentStep - 1;
        tl.tweenTo(labels[ns], { onComplete: () => { app.isAnimating = false; app.currentStep = ns; } });
      }
      return true; // hero повністю під контролем таблет-логіки
    }
    if (idx === 1 && dir < 0) {
      const s1 = app.sections[1];
      // секція 1 = is-our-clients і ще НЕ на старті → хай OC відмотує спершу (advance викличе oc.step)
      if (s1 && s1.isOurClients && s1.oc && s1.oc.state > 0) return false;
      // OC на старті (або секція 1 звичайна) → відмотуємо хореографію hero (16:9 повертається)
      app.isAnimating = true;
      app.currentSectionIndex = 0;
      app.persistSection(); // зберегти позицію (секція 1 → hero іде в обхід goToSection)
      if (s1 && s1.isOurClients && s1.oc) s1.oc.prepare(); // приховати заголовки/прогрес для наступної появи
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      tl.tweenTo(labels[MAX - 1], { onComplete: () => { app.isAnimating = false; app.currentStep = MAX - 1; } });
      return true;
    }
    return false; // решта — стандартний стекінг
  };

  // 03d — Секція is-our-clients (ADR-013): 3 набори карток + прогрес-бар + скрамбл текстів.
  //   mode='desktop' — вертикальний свап наборів (3 стани).
  //   mode='tablet'  — те саме + ВНУТРІШНІЙ зсув карток на 6-карткових наборах (окремі кроки):
  //     зсув набору1 → набір2 → набір3+скрамбл → зсув набору3 → наступна секція.
  //   Спільні: прогрес (трек 15% / лінія 100%, по наборах), скрамбл H2/label на появі,
  //   перепис параграфів на наборі 3. Стан/методи — у section.oc; advance/goToSection делегують.
  app.buildOurClients = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-our-clients'));
    if (!section) return;
    const el = section.el;
    const wraps = [...el.querySelectorAll('.our-client-card-wrapper')];
    if (wraps.length < 2) { console.warn('[Kulbit-OC] замало наборів карток'); return; }
    const bar = el.querySelector('.section-progresbar');
    const paras = [...el.querySelectorAll('.our-clients-text-content .width-193 p')];
    const paraWraps = [...el.querySelectorAll('.our-clients-text-content .width-193')];
    const h2 = el.querySelector('.text-size-section-h2');
    const label = el.querySelector('.text-size-section-label');
    const cardsOf = (w) => [...w.querySelectorAll('.our-clients-card')];

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const SC = (chars, speed) => ({ chars: chars || 'upperCase', speed: speed || 1 });
    const NW = wraps.length;

    const TXT = [
      { orig: [['Brand work', 'text-color-black-20'], [' trusted by industry leaders.', '']],
        next: [['Festival-recognized cinematic work.', 'text-color-black-20']] },
      { orig: [['Partnerships at', 'text-color-black-20'], [' scale and quality.', '']],
        next: [['Honored by', 'text-color-black-20'], [' leading international film festivals.', '']] }
    ];

    // Фіксуємо висоту обгорток параграфів — щоб абсолютний елемент не з'їжджав при стиранні
    paraWraps.forEach((w) => { w.style.height = ''; w.style.height = w.offsetHeight + 'px'; });

    // Прогрес-бар: трек 15% + дочірня лінія-заповнення 100%
    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      fill = bar.querySelector('.oc-fill');
      if (!fill) { fill = document.createElement('div'); fill.className = 'oc-fill'; bar.appendChild(fill); }
      Object.assign(fill.style, { position: 'absolute', left: '0', top: '0', height: '100%', width: '0%', backgroundColor: '#fdfcfc' });
      gsap.set(fill, { width: '0%' });
    }

    // — Скрамбл-утиліти (спільні) —
    const parseSegments = (e) => {
      const segs = [];
      e.childNodes.forEach((n) => {
        if (n.nodeType === 3) segs.push([n.textContent, '']);
        else if (n.nodeType === 1) segs.push([n.textContent, n.getAttribute('class') || '']);
      });
      return segs;
    };
    const buildSegDOM = (c, segs, fillText) => {
      c.textContent = '';
      const targets = [];
      let pend = false;
      segs.forEach(([raw, cls]) => {
        const lead = /^\s/.test(raw), trail = /\s$/.test(raw);
        const t = raw.replace(/\s+/g, ' ').trim();
        if (lead) pend = true;
        if (t) {
          if (pend) c.appendChild(document.createTextNode(' '));
          pend = false;
          const s = document.createElement('span');
          if (cls) s.className = cls;
          if (fillText) s.textContent = t;
          c.appendChild(s);
          targets.push([s, t]);
        }
        if (trail) pend = true;
      });
      return targets;
    };
    const morphParagraph = (p, segs) => {
      gsap.killTweensOf(p);
      gsap.to(p, {
        duration: 0.35, scrambleText: { text: '', ...SC('upperCase', 3) },
        onComplete: () => buildSegDOM(p, segs, false).forEach(([s, t]) => gsap.to(s, { duration: 0.6, scrambleText: { text: t, ...SC() } }))
      });
    };
    const morphTexts = (toNext) => paras.forEach((p, i) => morphParagraph(p, toNext ? TXT[i].next : TXT[i].orig));
    const setTexts = (toNext) => paras.forEach((p, i) => buildSegDOM(p, toNext ? TXT[i].next : TXT[i].orig, true));

    // Прогрес за індексом набору (0..NW-1)
    const setFill = (prog, animate) => {
      if (!fill) return;
      const w = ((prog + 1) / NW * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };
    // Заголовки (h2/label) скрамбляться ГЛОБАЛЬНО через 11-scramble.js за атрибутом
    //   [data-kulbit-scramble] (поява/вихід за видимістю у вьюпорті). Тут — лише картки,
    //   тексти карток (morphTexts/TXT) та прогрес-лінія.

    // Прогрес (заголовки керуються IO незалежно)
    // Прогрес-лінія: МИТТЄВО в 0 при підготовці (без видимого зворотного руху під час появи —
    //   спорожнення робить collapseCommon, коли секція реально сповзає геть). Фікс бага лінії.
    const prepareCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } }; // миттєво→0
    const enterCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } setFill(0, true); }; // 0→1/3
    const collapseCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } }; // плавно→0 разом зі сповзанням секції
    const showCommon = () => {}; // заголовки керуються IO; тут нічого

    section.isOurClients = true;

    if (mode === 'tablet' || mode === 'mobile') {
      // ТАБЛЕТ/МОБІЛКА: набори — вертикальні колонки; на наборах із зсувом — окремий крок «зсув карток».
      // Патерн зсувів per-набір (скільки карток зсунути): таблет [1,0,1], мобілка [2,1,2].
      const shiftN = (mode === 'mobile') ? [2, 1, 2] : [1, 0, 1];
      const cardStep = wraps.map((w) => {
        const c = cardsOf(w);
        return c.length > 1 ? (c[1].getBoundingClientRect().top - c[0].getBoundingClientRect().top) : 0;
      });
      // Генеруємо стадії з shiftN: поява → (зсув набору i, якщо shiftN[i]>0) → свап до наступного → ...
      const STAGES = (() => {
        const arr = [];
        const acc = new Array(NW).fill(0);
        arr.push({ cur: 0, shifts: acc.slice() });                                          // поява: набір 1
        for (let i = 0; i < NW; i++) {
          if ((shiftN[i] || 0) > 0) { acc[i] = shiftN[i]; arr.push({ cur: i, shifts: acc.slice() }); } // зсув набору i
          if (i < NW - 1) arr.push({ cur: i + 1, shifts: acc.slice() });                    // → наступний набір
        }
        return arr;
      })();
      const MAXST = STAGES.length - 1;
      const scrIdx = STAGES.findIndex((s) => s.cur === NW - 1); // поява останнього набору → перепис текстів
      const applyStage = (s, animate) => {
        const d = STAGES[s];
        wraps.forEach((w, i) => {
          const yp = i < d.cur ? -100 : (i > d.cur ? 100 : 0);
          const cy = -d.shifts[i] * cardStep[i];
          if (animate) { gsap.to(w, { yPercent: yp, duration: STEP, ease: EASE }); gsap.to(cardsOf(w), { y: cy, duration: STEP, ease: EASE }); }
          else { gsap.set(w, { yPercent: yp }); gsap.set(cardsOf(w), { y: cy }); }
        });
        setFill(d.cur, animate); // прогрес за індексом видимого набору
      };
      let stage = 0;
      applyStage(0, false); setTexts(false); prepareCommon(); // старт: прихований стан до появи
      section.oc = {
        get state() { return stage; },
        prepare() { stage = 0; applyStage(0, false); setTexts(false); prepareCommon(); },
        reset(toEnd) { stage = toEnd ? MAXST : 0; applyStage(stage, false); setTexts(stage >= scrIdx); showCommon(); },
        enter() { stage = 0; applyStage(0, false); enterCommon(); },
        collapse() { collapseCommon(); }, // секція сповзає геть → лінія плавно в 0
        dispose() {}, // заголовки скрамбляться глобально (11-scramble.js) — тут нічого прибирати
        step(dir) {
          const ns = Math.max(0, Math.min(MAXST, stage + dir));
          if (ns === stage) return false;
          const prev = stage; stage = ns;
          app.isAnimating = true;
          applyStage(stage, true);
          gsap.delayedCall(STEP, () => { app.isAnimating = false; });
          if (prev < scrIdx && stage >= scrIdx) morphTexts(true);   // перепис на появі останнього набору
          if (prev >= scrIdx && stage < scrIdx) morphTexts(false);  // назад → оригінал
          return true;
        }
      };
      console.log('[Kulbit-OC]', mode, 'готовий: наборів', NW, '| shiftN', shiftN.join(','), '| стадій', STAGES.length);
    } else {
      // ДЕСКТОП: простий вертикальний свап наборів (3 стани).
      const setCards = (s, animate) => wraps.forEach((w, i) => {
        const y = i < s ? -100 : (i > s ? 100 : 0);
        if (animate) gsap.to(w, { yPercent: y, duration: STEP, ease: EASE });
        else gsap.set(w, { yPercent: y });
      });
      let state = 0;
      setCards(0, false); setTexts(false); prepareCommon(); // старт: прихований стан до появи
      section.oc = {
        get state() { return state; },
        prepare() { state = 0; setCards(0, false); setTexts(false); prepareCommon(); },
        reset(toEnd) { state = toEnd ? NW - 1 : 0; setCards(state, false); setFill(state, false); setTexts(state === NW - 1); showCommon(); },
        enter() { state = 0; setCards(0, false); enterCommon(); },
        collapse() { collapseCommon(); }, // секція сповзає геть → лінія плавно в 0
        dispose() {}, // заголовки скрамбляться глобально (11-scramble.js) — тут нічого прибирати
        step(dir) {
          const ns = Math.max(0, Math.min(NW - 1, state + dir));
          if (ns === state) return false;
          const prev = state; state = ns;
          app.isAnimating = true;
          setCards(state, true);
          setFill(state, true);
          gsap.delayedCall(STEP, () => { app.isAnimating = false; });
          if (prev === 1 && state === 2) morphTexts(true);
          if (prev === 2 && state === 1) morphTexts(false);
          return true;
        }
      };
      console.log('[Kulbit-OC] desktop готовий, наборів:', NW);
    }
  };

  // 03c — Спец-секція is-projects (ADR-015 + ADR-016 re-approach): вертикальний свап відео + END-картинка.
  //   АДАПТИВНА через ВІКНО (WIN): desktop WIN=1 (одне відео на повний екран), tablet/mobile WIN=3
  //   (видно 3 картки). Елементи свапу = прямі діти [data-kulbit-project-group] (відео + остання
  //   [data-kulbit-project-end]). Видиме вікно [state .. state+WIN-1]: блоки height = slotH, решта 0;
  //   уся колонка зсунута по y на -(state*гэп) — гэп лишається між картками, але над вікном ховається
  //   за верхній край. maxState = total - WIN: останній стан — коли END став нижнім видимим → далі
  //   свайп = перехід на наступну секцію (advance). Свап: верхній блок вікна height→0 (стискається),
  //   знизу виростає наступний 0→slotH (розширюється), проміжні зсуваються вгору.
  //   Desktop тримає height у % (CSS картки реагують); tablet/mobile — px slotH + flex:none, бо там
  //   картки flex:1 1 0% (flex-grow ділив би висоту порівну й ігнорував height). Згорнуте відео →
  //   скидається на постер (пауза, час 0, контроли off). Прогрес-бар: (state+1)/(maxState+1).
  app.buildProjects = (mode) => {
    const group = document.querySelector('[data-kulbit-project-group]');
    if (!group) return;
    const section = app.sections.find((s) => s.el.contains(group));
    if (!section) { console.warn('[Kulbit-PV] секцію групи не знайдено'); return; }

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const isDesktop = mode === 'desktop';
    group.style.overflow = 'hidden';
    const gap = () => parseFloat(getComputedStyle(group).rowGap) || 0;

    const items = [...group.children].map((el) => {
      const isEnd   = el.matches('[data-kulbit-project-end]') || !!el.querySelector('[data-kulbit-project-end]');
      const isVideo = !isEnd && (el.matches('[data-kulbit-project-video]') || !!el.querySelector('[data-kulbit-project-video]'));
      const iframe  = el.querySelector('iframe');
      return {
        el, isVideo, isEnd,
        poster:   el.querySelector('[data-kulbit-poster]'),
        bigPlay:  el.querySelector('[data-kulbit-play]'),
        controls: el.querySelector('[data-kulbit-controls]'),
        player:   (isVideo && iframe && typeof Vimeo !== 'undefined') ? new Vimeo.Player(iframe) : null
      };
    });
    const els = items.map((r) => r.el);
    const total = items.length;
    if (total < 2) { console.warn('[Kulbit-PV] замало елементів свапу'); return; }

    // ВІКНО: desktop — 1 блок на повний екран; tablet/mobile — до 3 видимих блоків (захист min для малого total).
    const WIN = isDesktop ? 1 : Math.min(3, total);
    const maxState = total - WIN; // останній стан — коли END (остання дитина) став нижнім видимим
    // tablet/mobile: перебити flex:1 1 0% (інакше flex-grow ділить висоту порівну й ігнорує height)
    if (!isDesktop) gsap.set(els, { flex: 'none' });

    // slotH (лише tablet/mobile): доступна висота вьюпорта під групою / WIN.
    //   Простір над групою рахуємо ВІДНОСНО секції (group.top - section.top), а НЕ вьюпорта —
    //   щоб slotH не залежав від позиції секції на екрані (стекінг yPercent). Інакше при наїзді
    //   (секція ще під екраном) slotH виходив невірним → стрибок стану на завершенні появи.
    const slotHeight = () => {
      const wrapper = app.wrapper || document.querySelector('#smooth-wrapper');
      const wrapperH = wrapper ? wrapper.clientHeight : window.innerHeight;
      const gTop = group.getBoundingClientRect().top - section.el.getBoundingClientRect().top;
      const padB = parseFloat(getComputedStyle(section.el).paddingBottom) || 0; // section.el, НЕ section
      const availH = wrapperH - gTop - padB;
      return (availH - (WIN - 1) * gap()) / WIN;
    };

    // Прогрес-бар: трек 15% + дочірня лінія-заповнення 100% (.pv-fill), ширина (state+1)/(maxState+1)
    const bar = section.el.querySelector('.section-progresbar');
    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      fill = bar.querySelector('.pv-fill');
      if (!fill) { fill = document.createElement('div'); fill.className = 'pv-fill'; bar.appendChild(fill); }
      Object.assign(fill.style, { position: 'absolute', left: '0', top: '0', height: '100%', backgroundColor: '#fdfcfc' });
    }
    const setFill = (s, animate) => {
      if (!fill) return;
      const w = ((s + 1) / (maxState + 1) * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };
    const prepareFill  = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } };           // миттєво→0
    const enterFill    = () => { prepareFill(); setFill(0, true); };                                                  // 0→1/N (поява)
    const collapseFill = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } }; // плавно→0 (сповзання)

    // Скидання відео-елемента на початковий стан (постер + пауза + час 0 + контроли off)
    const resetItem = (rec) => {
      if (!rec.isVideo) return;
      if (rec.player)   { rec.player.pause(); rec.player.setCurrentTime(0); }
      if (rec.poster)   gsap.set(rec.poster,  { autoAlpha: 1 });
      if (rec.bigPlay)  gsap.set(rec.bigPlay, { autoAlpha: 1 });
      if (rec.controls) rec.controls.style.display = 'none';
    };
    const resetOthers = (active) => items.forEach((r, i) => { if (i !== active) resetItem(r); });

    // Зсув колонки: над вікном s блоків (0px) + s гэпів → зсув = -(s*гэп)
    const offsetFor = (s) => -s * gap();
    // Висоти блоків для стану s: вікно [s..s+WIN-1] видиме, решта згорнута.
    //   desktop — у % (картка на повний екран); tablet/mobile — px slotH.
    const setHeights = (s, animate) => {
      const sh = isDesktop ? null : slotHeight();
      items.forEach((r, i) => {
        const inWindow = i >= s && i < s + WIN;
        const h = isDesktop ? (inWindow ? '100%' : '0%') : (inWindow ? sh : 0);
        if (animate) gsap.to(r.el, { height: h, duration: STEP, ease: EASE });
        else gsap.set(r.el, { height: h });
      });
    };
    const moveColumn = (s, animate) => {
      if (animate) gsap.to(els, { y: offsetFor(s), duration: STEP, ease: EASE });
      else gsap.set(els, { y: offsetFor(s) });
    };
    // Дискретний стан без анімації
    const applyState = (s) => { setHeights(s, false); moveColumn(s, false); };

    let state = 0;
    applyState(0); resetOthers(0); prepareFill(); // старт: вікно з 0, решта на постері, лінія 0

    section.isProjects = true;
    section.pv = {
      get state() { return state; },
      prepare() { state = 0; applyState(0); resetOthers(0); prepareFill(); }, // наїзд: приховано (лінія 0)
      enter()   { state = 0; applyState(0); resetOthers(0); enterFill(); },   // повне накриття: лінія 0→1/N
      collapse() { collapseFill(); },                                          // секція сповзає геть → лінія плавно в 0
      reset(toEnd) { state = toEnd ? maxState : 0; applyState(state); setFill(state, false); resetOthers(state); }, // миттєвий стан
      // вихід із брейкпоінта: повертаємо натуральний лейаут (висоти/трансформ/flex зі step живуть
      //   поза matchMedia-контекстом, тож чистимо вручну — щоб інший брейкпоінт стартував чистим)
      dispose() { group.style.overflow = ''; gsap.set(els, { clearProps: 'height,transform,flex' }); if (fill) fill.remove(); },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false;        // межа вікна → advance викличе goToSection (перехід секції)
        const goingDown = ns > state;
        const out = goingDown ? items[state] : items[state + WIN - 1]; // блок, що виходить з вікна → на постер
        state = ns;
        app.isAnimating = true;
        resetItem(out);
        setHeights(ns, true);                  // верх схлоп / новий виріст / проміжні без змін
        moveColumn(ns, true);                  // колонка плавно зсувається
        setFill(ns, true);
        gsap.delayedCall(STEP, () => { app.isAnimating = false; });
        return true;
      }
    };
    console.log('[Kulbit-PV]', mode, 'готовий | елементів:', total, '| WIN', WIN, '| maxState', maxState, '| гэп', Math.round(gap()) + 'px');
  };

  // 03d — Спец-секція is-our-services: ГОРИЗОНТАЛЬНИЙ свап карток ([data-kulbit-hswipe-group]).
  //   Заголовки скрамбляться глобально (11-scramble.js). Стани:
  //   • 0 (поява): група виїжджає знизу + opacity; h2 написаний.
  //   • 1: h2 стирається скрамблом + його висота колапсує (flex сам підтягує картки вгору, геп = gap).
  //   • 2..total: горизонтальний свап карток (1 свайп = картка), зсув по x на (ширина + columnGap).
  app.buildHSwipe = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-our-services'));
    if (!section) return;
    const group = section.el.querySelector('[data-kulbit-hswipe-group]');
    if (!group) return;
    const cards = [...group.children];
    const total = cards.length;
    if (total < 2) { console.warn('[Kulbit-HS] замало карток'); return; }

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const RISE = 60; // px — група виїжджає знизу на появі
    const maxState = total; // 0 поява, 1 (h2 стерся + картки вгору), 2..total — свап карток
    const swapIndexOf = (s) => Math.max(0, s - 1); // картка у вікні: state 0,1 → 0; 2 → 1; ...
    const gap = () => parseFloat(getComputedStyle(group).columnGap) || 0;
    const cardW = () => cards[0].getBoundingClientRect().width;
    const shiftFor = (s) => -swapIndexOf(s) * (cardW() + gap()); // зсув групи по x за індексом картки

    // Крок 1 ховає заголовок скрамблом. Desktop/tablet: колапс висоти h2 (flex підтягує картки вгору,
    //   label лишається). MOBILE: ховаємо ВЕСЬ верх (progressbar + заголовок, autoAlpha) і підіймаємо
    //   картки рівно до padding-top секції — мало місця, картки мають іти на весь екран.
    const label = section.el.querySelector('.text-size-section-label');
    const h2 = section.el.querySelector('.text-size-section-h2');
    const isMobile = mode === 'mobile';
    const titleWrap = label ? label.closest('.flex-h-v-v') : null;
    const scrambleEls = (isMobile ? [label, h2] : [h2]).filter(Boolean); // що стирати скрамблом
    let origH2 = 0; // desktop/tablet: натуральна висота h2 (для колапсу/реверсу)
    let groupMT = 0; // desktop/tablet: значення margin-top:auto групи на state 0 (для реверсу)
    const measureTitle = () => { if (!isMobile && h2) origH2 = parseFloat(h2.style.height) || h2.offsetHeight; };
    const setTitle = (collapsed, animate) => {
      scrambleEls.forEach((el) => { const c = app.scrambles && app.scrambles.get(el); if (c) { collapsed ? c.out() : c.in(); } });
      if (isMobile) {
        // mobile: ховаємо progressbar + заголовок, картки підіймаємо до padding-top секції (bar — closure нижче)
        let upH = 0;
        if (collapsed) {
          const gr = group.getBoundingClientRect(), sr = section.el.getBoundingClientRect();
          const padTop = parseFloat(getComputedStyle(section.el).paddingTop) || 0;
          upH = gr.top - (sr.top + padTop);
        }
        const tops = [bar, titleWrap].filter(Boolean);
        const a = collapsed ? 0 : 1;
        if (animate) { gsap.to(tops, { autoAlpha: a, duration: STEP, ease: EASE }); gsap.to(group, { y: collapsed ? -upH : 0, duration: STEP, ease: EASE }); }
        else        { gsap.set(tops, { autoAlpha: a }); gsap.set(group, { y: collapsed ? -upH : 0 }); }
        return;
      }
      // desktop/tablet: колапс висоти h2 + прибрати margin-top:auto групи (інакше auto зʼїдає
      //   звільнене місце й картки не підіймаються). На реверсі повертаємо margin-top, потім — знову auto.
      if (!h2) return;
      const h = collapsed ? 0 : origH2;
      if (collapsed) groupMT = parseFloat(getComputedStyle(group).marginTop) || 0; // auto-значення на state 0
      if (animate) {
        gsap.to(h2, { height: h, duration: STEP, ease: EASE });
        if (collapsed) gsap.to(group, { marginTop: 0, duration: STEP, ease: EASE });
        else gsap.to(group, { marginTop: groupMT, duration: STEP, ease: EASE, onComplete: () => gsap.set(group, { marginTop: '' }) });
      } else {
        gsap.set(h2, { height: h });
        gsap.set(group, { marginTop: collapsed ? 0 : '' });
      }
    };

    // Прогрес-бар (як pv/oc): трек + дочірня лінія .hs-fill, ширина (state+1)/(maxState+1)
    const bar = section.el.querySelector('.section-progresbar');
    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.flexShrink = '0'; // інакше flex-v стискає бар (2px) до 0, бо контейнер переповнений
      bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      fill = bar.querySelector('.hs-fill');
      if (!fill) { fill = document.createElement('div'); fill.className = 'hs-fill'; bar.appendChild(fill); }
      Object.assign(fill.style, { position: 'absolute', left: '0', top: '0', height: '100%', backgroundColor: '#fdfcfc' });
    }
    const setFill = (s, animate) => {
      if (!fill) return;
      const w = ((s + 1) / (maxState + 1) * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };
    const prepareFill  = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } };
    const enterFill    = () => { prepareFill(); setFill(0, true); };
    const collapseFill = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } };

    const moveX     = (s, animate) => { const x = shiftFor(s); animate ? gsap.to(group, { x, duration: STEP, ease: EASE }) : gsap.set(group, { x }); };
    const showCards = () => gsap.fromTo(group, { y: RISE, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: STEP, ease: EASE });
    const hideCards = () => gsap.set(group, { autoAlpha: 0, y: RISE });

    let state = 0;
    group.style.willChange = 'transform';
    measureTitle();                                          // натуральна висота h2 (для реверсу кроку 1)
    moveX(0, false); setTitle(false, false); hideCards(); prepareFill(); // старт: картка 0, h2 написаний, приховано

    section.isHSwipe = true;
    section.hswipe = {
      get state() { return state; },
      prepare() { state = 0; moveX(0, false); setTitle(false, false); hideCards(); prepareFill(); }, // наїзд: приховано
      enter()   { state = 0; measureTitle(); moveX(0, false); setTitle(false, false); showCards(); enterFill(); }, // картки виїжджають; h2 пишеться глобально
      collapse() { collapseFill(); },
      reset(toEnd) { state = toEnd ? maxState : 0; moveX(state, false); setTitle(state >= 1, false); gsap.set(group, { autoAlpha: 1, y: 0 }); setFill(state, false); }, // origH2 НЕ перевимірюємо тут (h2 може бути сколапсований)
      dispose() { gsap.set(group, { clearProps: 'transform,opacity,visibility,willChange' }); if (h2) h2.style.height = ''; gsap.set([bar, titleWrap].filter(Boolean), { clearProps: 'opacity,visibility' }); if (fill) fill.remove(); },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false;        // межа → advance викличе goToSection
        const prev = state; state = ns;
        app.isAnimating = true;
        // заголовок ховаємо/показуємо ТІЛЬКИ на межі 0↔1 (не на кожному свапі — інакше mobile
        //   перевимірював би upH від уже піднятої групи й картки стрибали б)
        if (prev === 0 && ns >= 1) setTitle(true, true);        // крок 1: заголовок зникає, картки вгору
        else if (prev >= 1 && ns === 0) setTitle(false, true);  // назад: заголовок пишеться, картки вниз
        moveX(ns, true);                       // свап карток (за swapIndex)
        setFill(ns, true);
        gsap.delayedCall(STEP, () => { app.isAnimating = false; });
        return true;
      }
    };
    console.log('[Kulbit-HS]', mode, 'готовий | карток', total, '| maxState', maxState, '| h2H', Math.round(origH2), '| зсув', Math.round(cardW() + gap()) + 'px');
  };

  // 03g — Working Process (section.wp): REVEAL появи секції + STACK-CARDS, синхронізовані з SVG.
  //   REVEAL (enter): bg малюється -> крапки спалахують по черзі -> хвостик -> 3 сірі дуги -> label ->
  //     weeks -> синя+червона лінії; arrow1 промальовується БІЛОЮ суцільною поверх сірої + градієнт-тінь +
  //     білий наконечник; dot1/dot2 білі; cards-wrapper виїзд + формування стеку; is-second.
  //   КРОКИ (step): падіння активної + СИНХРОННА біла промальовка наступної стрілки (наступна картка
  //     стає в центр рівно коли стрілка домалювалась) + білішання відповідної крапки; реверс на крок назад.
  //   Вихід угору (collapse) -> reveal швидкий реверс (REV_SPEED). Desktop/tablet однаково; mobile спрощено.
  //   ADR-019 (картки) + SVG-ітерація. Пунктир (bg/сірі дуги) малюється clip-sweep (без розтягу);
  //   суцільні (blue/red/біла-клон) -- strokeDashoffset. Картки: z-index 75/50/25 фіксований по DOM.
  app.buildWorkingProcess = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-working-process'));
    if (!section) return;
    const sec = section.el;
    const cards = [...sec.querySelectorAll('.working-process-card')];
    if (cards.length < 2) { console.warn('[Kulbit-WP] замало карток'); return; }

    const NS = 'http://www.w3.org/2000/svg';
    const VERTICAL = mode !== 'desktop';
    const FALL_X = VERTICAL ? 0 : -50, FALL_Y = VERTICAL ? 100 : 50, FALL_ROT = -10;
    const STACK_X = VERTICAL ? 0 : 50, STACK_SS = VERTICAL ? 0.05 : 0.15, DARK = 0.4;
    const Z_VALUES = [75, 50, 25];
    const DUR_FALL = 0.9, DUR_SLIDE = 0.75, EASE = 'power1.inOut';
    const DUR_BG = 0.7, DUR_ARROW = 0.4, DUR_LABEL = 0.5, WK_STAG = 0.1, WK_DUR = 0.4;
    const DUR_BLUE = 0.7, DUR_RED = 0.45, DUR_AWHITE = 0.6, DUR_GRAD = 0.6, DUR_DOTCOL = 0.3, DUR_CARDSWRAP = 0.5;
    const WHITE_END_GAP = 5;   // px: біла лінія не доходить до кінчика наконечника
    const REV_SPEED = 5;       // у скільки разів швидша зворотна анімація при виході з секції
    const REVEAL_SPEED = 1.7;  // прискорення reveal-появи секції (перший етап) -- кроки карток не чіпає
    const WHITE10 = (getComputedStyle(sec).getPropertyValue('--colors--white-10') || '').trim() || '#fdfcfc';

    const maxState = cards.length - 1;
    const ovOf = (c) => c.querySelector('.kulbit-wp-overlay');
    const cardW = cards[0].getBoundingClientRect().width;

    // HTML-блоки появи
    const labelWrap   = sec.querySelector('.working-process-label-wrapper:not(.is-second)');
    const labelSecond = sec.querySelector('.working-process-label-wrapper.is-second');
    const weeks       = [...sec.querySelectorAll('.working-process-week')];
    const cardsWrapper = sec.querySelector('.working-process-cards-wrapper');

    // -- розкладка карток: i=0 relative; i>0 absolute центрована; overlay для затемнення стеку --
    cards.forEach((c, i) => {
      c.style.transformOrigin = '50% 50%';
      c.style.zIndex = String(Z_VALUES[i] || 25);
      if (i > 0) { c.style.position = 'absolute'; c.style.top = '0'; c.style.left = '50%'; c.style.marginLeft = (-cardW / 2) + 'px'; }
      let ov = ovOf(c);
      if (!ov) {
        ov = document.createElement('div'); ov.className = 'kulbit-wp-overlay';
        Object.assign(ov.style, { position: 'absolute', inset: '0', background: '#000', opacity: '0', borderRadius: getComputedStyle(c).borderRadius, pointerEvents: 'none', zIndex: '10' });
        c.appendChild(ov);
      }
    });

    // ===== активна SVG-діаграма (з лінією bg, видима на цьому брейкпоінті) =====
    const svgs = [...sec.querySelectorAll('svg')];
    const svg = svgs.find((s) => s.querySelector('[data-kulbit-svg-line]') && s.getBoundingClientRect().width > 1 && s.offsetParent !== null)
             || svgs.find((s) => s.querySelector('[data-kulbit-svg-line]') && s.getBoundingClientRect().width > 1) || null;

    const cleanSVG = () => {
      if (!svg) return;
      [...svg.querySelectorAll('clipPath')].forEach((cp) => { if (cp.id && cp.id.indexOf('wpClip') === 0) cp.remove(); });
      [...svg.querySelectorAll('[id^="wpW"]')].forEach((el) => el.remove());
    };
    cleanSVG(); // прибрати рудименти попередньої побудови

    let bg = null, blue = null, red = null, tail = null;
    let dotRings = [], arrowParts = [], arrowNums = [], greyStroke = null, greyHead = null;
    let W = 0, H = 0, bgRect = null, blueLen = 0, redLen = 0;
    const arrowRects = {}, whiteClones = {};
    const dotByN = (n) => dotRings.find((d) => d.getAttribute('data-kulbit-svg-dot') === String(n));
    const innerOf = (ring) => ring.nextElementSibling;
    const arrowGroup = (n) => {
      const parts = arrowParts.filter((el) => el.getAttribute('data-kulbit-svg-arrow') === String(n));
      return { line: parts.find((el) => el.getAttribute('data-kulbit-svg-part') === 'line'), head: parts.find((el) => el.getAttribute('data-kulbit-svg-part') === 'head'), fill: parts.find((el) => el.getAttribute('data-kulbit-svg-part') === 'fill') };
    };

    if (svg) {
      const vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(' ');
      W = parseFloat(vb[2]); H = parseFloat(vb[3]);
      const lines = [...svg.querySelectorAll('[data-kulbit-svg-line]')];
      const byLine = (v) => lines.find((el) => el.getAttribute('data-kulbit-svg-line') === v);
      bg = byLine('bg'); blue = byLine('blue'); red = byLine('red');
      tail = svg.querySelector('[data-kulbit-svg-tail]');
      dotRings = [...svg.querySelectorAll('[data-kulbit-svg-dot]')];
      arrowParts = [...svg.querySelectorAll('[data-kulbit-svg-arrow]')];
      arrowNums = [...new Set(arrowParts.map((el) => +el.getAttribute('data-kulbit-svg-arrow')))].sort((a, b) => a - b);

      // сірі кольори зчитуємо до наших сетів (для коректного реверсу fromTo)
      greyStroke = dotByN(1) ? getComputedStyle(dotByN(1)).stroke : null;
      greyHead = arrowGroup(1).head ? getComputedStyle(arrowGroup(1).head).fill : null;

      const makeClip = (id, x0) => {
        const cp = document.createElementNS(NS, 'clipPath'); cp.setAttribute('id', id); cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const rc = document.createElementNS(NS, 'rect'); rc.setAttribute('x', '0'); rc.setAttribute('y', '0'); rc.setAttribute('width', String(x0)); rc.setAttribute('height', String(H));
        cp.appendChild(rc); svg.appendChild(cp); return rc;
      };

      // стартово приховані svg-вузли
      arrowNums.forEach((n) => { const g = arrowGroup(n); if (g.fill) gsap.set(g.fill, { autoAlpha: 0 }); });
      if (tail) gsap.set(tail, { autoAlpha: 0 });
      dotRings.forEach((r) => { const inn = innerOf(r); [r, inn].filter(Boolean).forEach((el) => gsap.set(el, { autoAlpha: 0 })); });
      [blue, red].filter(Boolean).forEach((el) => gsap.set(el, { autoAlpha: 0 }));

      if (bg) { bgRect = makeClip('wpClipBg', 0); bg.setAttribute('clip-path', 'url(#wpClipBg)'); }

      arrowNums.forEach((n) => {
        const g = arrowGroup(n); if (!g.line) return;
        const bb = g.line.getBBox(); const hb = g.head ? g.head.getBBox() : null;
        const x0 = Math.floor(bb.x); const x1 = Math.ceil(Math.max(bb.x + bb.width, hb ? hb.x + hb.width : 0)) + 2;
        const rc = makeClip('wpClipArrow' + n, x0);
        g.line.setAttribute('clip-path', 'url(#wpClipArrow' + n + ')');
        if (g.head) g.head.setAttribute('clip-path', 'url(#wpClipArrow' + n + ')');
        gsap.set([g.line, g.head].filter(Boolean), { autoAlpha: 1 });
        arrowRects[n] = { rc, x0, x1 };
      });

      blueLen = blue ? blue.getTotalLength() : 0;
      redLen = red ? red.getTotalLength() : 0;

      // білі клони стрілок (arrow1 -- у reveal; решта -- на кроках); усі стартують недомальовані
      arrowNums.forEach((n) => {
        const g = arrowGroup(n); if (!g.line) return;
        const cl = g.line.cloneNode(true); cl.setAttribute('id', 'wpW' + n);
        cl.removeAttribute('data-kulbit-svg-arrow'); cl.removeAttribute('data-kulbit-svg-part'); cl.removeAttribute('clip-path');
        cl.style.stroke = WHITE10; cl.style.strokeWidth = '2'; cl.style.fill = 'none';
        g.line.parentNode.insertBefore(cl, g.line.nextSibling);
        const len = cl.getTotalLength(); gsap.set(cl, { strokeDasharray: len, strokeDashoffset: len });
        whiteClones[n] = { el: cl, len };
      });
    }

    // HTML стартово приховані; картки складені під основною
    const htmlEls = [labelWrap, labelSecond, ...weeks].filter(Boolean);
    if (htmlEls.length) gsap.set(htmlEls, { autoAlpha: 0, y: 40 });
    if (cardsWrapper) gsap.set(cardsWrapper, { autoAlpha: 0, y: 40 });

    let state = 0;

    // картки: вектор стану
    const cardVars = (i, s) => {
      const rank = i - s;
      if (rank < 0) return { card: { xPercent: FALL_X, yPercent: FALL_Y, scale: 1, rotation: FALL_ROT, opacity: 0 }, ov: { opacity: 0 } };
      if (rank === 0) return { card: { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }, ov: { opacity: 0 } };
      return { card: { xPercent: STACK_X * rank, yPercent: 0, scale: 1 - STACK_SS * rank, rotation: 0, opacity: 1 }, ov: { opacity: DARK * rank } };
    };
    const resetCardsToStart = () => { // reveal-старт: ПОВНИЙ reset усіх карток (вкл. yPercent) -> основна по центру, решта складена під нею
      cards.forEach((c) => { gsap.set(c, { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }); const ov = ovOf(c); if (ov) gsap.set(ov, { opacity: 0 }); });
    };
    resetCardsToStart();

    // крок-SVG (стрілки 2+, крапки 3+): миттєвий стан для state s
    const setStepSVGInstant = (s) => {
      arrowNums.forEach((n) => {
        if (n < 2) return; // arrow1 -- у reveal
        const drawn = n <= s + 1; const wc = whiteClones[n]; const g = arrowGroup(n);
        if (wc) gsap.set(wc.el, { strokeDashoffset: drawn ? WHITE_END_GAP : wc.len });
        if (g.fill) gsap.set(g.fill, { autoAlpha: drawn ? 1 : 0 });
        if (g.head && greyHead) gsap.set(g.head, { fill: drawn ? WHITE10 : greyHead });
      });
      dotRings.forEach((r) => { const n = +r.getAttribute('data-kulbit-svg-dot'); if (n < 3 || n >= dotRings.length || !greyStroke) return; gsap.set(r, { stroke: n <= s + 2 ? WHITE10 : greyStroke }); }); // остання крапка (Traditional-кінець) лишається сірою
    };
    setStepSVGInstant(0);

    // миттєвий ПОВНИЙ стан (cards + усе svg) для state s -- для reset (persistence/jump)
    const setStateInstant = (s) => {
      cards.forEach((c, i) => { const v = cardVars(i, s); gsap.set(c, v.card); const ov = ovOf(c); if (ov) gsap.set(ov, v.ov); });
      setStepSVGInstant(s);
      state = s;
    };

    // ===== REVEAL timeline (програється на enter, реверситься на collapse) =====
    const revealTL = gsap.timeline({ paused: true, onComplete: () => { app.isAnimating = false; } });
    (() => {
      const tl = revealTL;
      if (svg && bgRect) {
        tl.fromTo(bgRect, { attr: { width: 0 } }, { attr: { width: W }, duration: DUR_BG, ease: 'none' }, 0);
        dotRings.forEach((r) => { const at = (parseFloat(r.getAttribute('cx')) / W) * DUR_BG; const inn = innerOf(r); [r, inn].filter(Boolean).forEach((el) => tl.to(el, { autoAlpha: 1, duration: 0.25, ease: 'power1.out' }, at)); });
        if (tail) tl.to(tail, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, DUR_BG);
        arrowNums.forEach((n, i) => { const a = arrowRects[n]; if (a) tl.fromTo(a.rc, { attr: { width: a.x0 } }, { attr: { width: a.x1 }, duration: DUR_ARROW, ease: 'none' }, DUR_BG + i * DUR_ARROW); });
      }
      const afterArrows = svg ? DUR_BG + arrowNums.length * DUR_ARROW : 0.2;
      if (labelWrap) tl.to(labelWrap, { autoAlpha: 1, y: 0, duration: DUR_LABEL, ease: 'power2.out' }, afterArrows);
      const weeksStart = afterArrows + 0.25;
      if (weeks.length) tl.to(weeks, { autoAlpha: 1, y: 0, duration: WK_DUR, ease: 'power2.out', stagger: WK_STAG }, weeksStart);
      const weeksEnd = weeks.length ? (weeksStart + (weeks.length - 1) * WK_STAG + WK_DUR) : afterArrows;

      const phase = weeksEnd + 0.15, whiteEnd = phase + DUR_AWHITE, redStart = phase + DUR_BLUE, redEnd = redStart + DUR_RED;

      if (blue && blueLen) tl.fromTo(blue, { autoAlpha: 1, strokeDasharray: blueLen, strokeDashoffset: blueLen }, { strokeDashoffset: 0, duration: DUR_BLUE, ease: 'none' }, phase);
      if (red && redLen) tl.fromTo(red, { autoAlpha: 1, strokeDasharray: redLen, strokeDashoffset: redLen }, { strokeDashoffset: 0, duration: DUR_RED, ease: 'none' }, redStart);

      const a1 = arrowGroup(1);
      if (whiteClones[1]) tl.fromTo(whiteClones[1].el, { strokeDashoffset: whiteClones[1].len }, { strokeDashoffset: WHITE_END_GAP, duration: DUR_AWHITE, ease: 'power1.inOut' }, phase);
      if (a1.fill) tl.to(a1.fill, { autoAlpha: 1, duration: DUR_GRAD, ease: 'power1.out' }, phase);
      if (a1.head && greyHead) tl.fromTo(a1.head, { fill: greyHead }, { fill: WHITE10, duration: DUR_AWHITE * 0.55, ease: 'power1.inOut' }, phase + DUR_AWHITE * 0.45);
      if (dotByN(1) && greyStroke) tl.fromTo(dotByN(1), { stroke: greyStroke }, { stroke: WHITE10, duration: DUR_DOTCOL, ease: 'power1.out' }, phase);
      if (dotByN(2) && greyStroke) tl.fromTo(dotByN(2), { stroke: greyStroke }, { stroke: WHITE10, duration: DUR_DOTCOL, ease: 'power1.out' }, whiteEnd);

      if (cardsWrapper) tl.fromTo(cardsWrapper, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: DUR_CARDSWRAP, ease: 'power2.out' }, whiteEnd);
      const slideAt = whiteEnd + 0.3;
      cards.forEach((c, i) => { if (i === 0) return; const ov = ovOf(c); tl.fromTo(c, { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }, { xPercent: STACK_X * i, scale: 1 - STACK_SS * i, duration: DUR_SLIDE, ease: EASE }, slideAt); if (ov) tl.fromTo(ov, { opacity: 0 }, { opacity: DARK * i, duration: DUR_SLIDE, ease: EASE }, slideAt); });

      if (labelSecond) tl.to(labelSecond, { autoAlpha: 1, y: 0, duration: DUR_LABEL, ease: 'power2.out' }, redEnd);
    })();

    // ===== крок карток + синхронна SVG =====
    let stepTL = null;
    const stepTo = (target) => {
      target = Math.max(0, Math.min(maxState, target));
      if (target === state) return false;
      const dir = target > state ? 1 : -1;
      const hi = Math.max(state, target);
      const arrowN = hi + 1, dotN = hi + 2; // 0<->1: стрілка2/крапка3 ; 1<->2: стрілка3/крапка4
      if (stepTL) stepTL.kill();
      app.isAnimating = true;
      stepTL = gsap.timeline({ onComplete: () => { app.isAnimating = false; } });
      // картки
      cards.forEach((c, i) => {
        const v = cardVars(i, target); const ov = ovOf(c); const dur = (i - target) < 0 ? DUR_FALL : DUR_SLIDE;
        stepTL.to(c, Object.assign({ duration: dur, ease: EASE }, v.card), 0);
        if (ov) stepTL.to(ov, Object.assign({ duration: dur, ease: EASE }, v.ov), 0);
      });
      // SVG синхронно: стрілка домальовується разом із карткою-в-центр (DUR_SLIDE)
      if (svg) {
        const wc = whiteClones[arrowN], g = arrowGroup(arrowN), dotEl = (dotN < dotRings.length) ? dotByN(dotN) : null; // остання крапка лишається сірою
        if (dir > 0) {
          if (wc) stepTL.to(wc.el, { strokeDashoffset: WHITE_END_GAP, duration: DUR_SLIDE, ease: EASE }, 0);
          if (g.fill) stepTL.to(g.fill, { autoAlpha: 1, duration: DUR_SLIDE, ease: 'power1.out' }, 0);
          if (g.head && greyHead) stepTL.to(g.head, { fill: WHITE10, duration: DUR_SLIDE * 0.55, ease: EASE }, DUR_SLIDE * 0.45);
          if (dotEl && greyStroke) stepTL.to(dotEl, { stroke: WHITE10, duration: DUR_DOTCOL, ease: 'power1.out' }, DUR_SLIDE); // після стрілки
        } else {
          if (wc) stepTL.to(wc.el, { strokeDashoffset: wc.len, duration: DUR_SLIDE, ease: EASE }, 0);
          if (g.fill) stepTL.to(g.fill, { autoAlpha: 0, duration: DUR_SLIDE, ease: 'power1.out' }, 0);
          if (g.head && greyHead) stepTL.to(g.head, { fill: greyHead, duration: DUR_SLIDE * 0.55, ease: EASE }, 0);
          if (dotEl && greyStroke) stepTL.to(dotEl, { stroke: greyStroke, duration: DUR_DOTCOL, ease: 'power1.out' }, 0);
        }
      }
      state = target;
      return true;
    };

    section.isWP = true;
    section.wp = {
      get state() { return state; },
      prepare() {                                   // підхід згори -> стартовий прихований стан
        if (stepTL) stepTL.kill();
        state = 0;
        revealTL.timeScale(1).pause(0);
        resetCardsToStart();
        setStepSVGInstant(0);
      },
      enter() {                                     // повне накриття -> reveal вперед, прискорено (блокуємо скрол на час)
        app.isAnimating = true;
        revealTL.timeScale(REVEAL_SPEED).play();
      },
      collapse() { revealTL.timeScale(REV_SPEED).reverse(); },   // вихід угору -> швидкий реверс
      reset(toEnd) {                                // миттєвий стан (persistence/jump)
        if (stepTL) stepTL.kill();
        revealTL.timeScale(1).progress(1).pause(); // reveal-елементи у кінець
        setStateInstant(toEnd ? maxState : 0);     // cards + усе svg для стану
      },
      dispose() {                                   // вихід з брейкпоінта -- повне очищення
        revealTL.kill(); if (stepTL) stepTL.kill();
        cleanSVG();
        [bg, ...arrowParts].forEach((el) => el && el.removeAttribute('clip-path'));
        const svgEls = [bg, blue, red, tail, ...arrowParts, ...dotRings];
        dotRings.forEach((r) => { const inn = innerOf(r); if (inn) svgEls.push(inn); });
        [...svgEls, labelWrap, labelSecond, ...weeks, cardsWrapper].filter(Boolean).forEach((el) => gsap.set(el, { clearProps: 'all' }));
        cards.forEach((c) => {
          gsap.set(c, { clearProps: 'all' });
          c.style.position = ''; c.style.top = ''; c.style.left = ''; c.style.marginLeft = ''; c.style.zIndex = ''; c.style.transformOrigin = '';
          const ov = ovOf(c); if (ov) ov.remove();
        });
      },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false; // межа -> advance викличе goToSection
        return stepTo(ns);
      }
    };
    console.log('[Kulbit-WP]', mode, 'готовий | карток', cards.length, '| maxState', maxState, '| svg', !!svg, '| стрілок', arrowNums.length, '| режим', VERTICAL ? 'vertical' : 'horizontal');
  };

  // 04 — Побудова паузованого таймлайну секції з атрибутів.
  //      Початковий стан (крок 0) виставляється gsap.set; крок 1 — це кінець таймлайну.
  //      Фази задаються data-kulbit-order (0 — перша, далі — послідовно). Без order — усе разом.
  app.buildSectionTimeline = (els) => {
    // Початковий стан (крок 0)
    els.forEach((el) => {
      const start = {};
      if (el.hasAttribute('data-kulbit-y')) start.yPercent = 0;
      if (el.hasAttribute('data-kulbit-scale')) {
        start.scale = num(el, 'data-kulbit-scale-from', 1);
        start.transformOrigin = '50% 50%';
      }
      if (el.hasAttribute('data-kulbit-fade')) start.autoAlpha = 1;
      gsap.set(el, start);
    });

    const orderOf = (el) => parseInt(el.getAttribute('data-kulbit-order') || '0', 10);
    const orders = [...new Set(Array.from(els, orderOf))].sort((a, b) => a - b);

    const tl = gsap.timeline({
      paused: true,
      defaults: { duration: app.config.stepDuration, ease: app.config.ease },
      onComplete: () => { app.isAnimating = false; },
      onReverseComplete: () => { app.isAnimating = false; }
    });

    // Фази по черзі ('>' — після попередньої); всередині фази — одночасно ('<')
    orders.forEach((ord, gi) => {
      els.filter((el) => orderOf(el) === ord).forEach((el, i) => {
        const to = {};
        if (el.hasAttribute('data-kulbit-y')) to.yPercent = num(el, 'data-kulbit-y', 0);
        if (el.hasAttribute('data-kulbit-scale')) to.scale = num(el, 'data-kulbit-scale', 1);
        if (el.hasAttribute('data-kulbit-fade')) to.autoAlpha = num(el, 'data-kulbit-fade', 0);
        tl.to(el, to, i === 0 ? (gi === 0 ? 0 : '>') : '<');
      });
    });

    return tl;
  };

  // — Стекінг-лейаут (ADR-010): секції абсолютом одна над одною, z-index за індексом.
  //   JS застосовує це в РАНТАЙМІ — у Webflow секції лишаються relative (зручно редагувати).
  app.setupStacking = () => {
    if (app.content) {
      app.content.style.position = 'relative';
      app.content.style.height = '100vh';
    }
    app.sections.forEach((s) => {
      Object.assign(s.el.style, {
        position: 'absolute', top: '0', left: '0', width: '100%', height: '100vh'
      });
      s.el.style.zIndex = String(s.index); // наступна секція — вище
    });
    app.applyStackingPositions(); // початковий стан
    console.log('[Kulbit-Stack] лейаут стекінгу застосовано, секцій:', app.sections.length);
  };

  // — Дискретні позиції стекінгу: секції 0..current накладені (y:0), решта під екраном (y:100%).
  app.applyStackingPositions = () => {
    app.sections.forEach((s) => {
      gsap.set(s.el, { yPercent: s.index <= app.currentSectionIndex ? 0 : 100 });
    });
  };

  // 05 — Стан reveal-кроків секції: shown=false → усі сховані; true → усі показані.
  app.resetSteps = (section, shown) => {
    if (!section.isStepped) return;
    section.steps.forEach((el) => {
      gsap.set(el, shown ? { autoAlpha: 1, y: 0 } : { autoAlpha: 0, y: 40 });
    });
  };

  // 06 — Програти reveal-крок i
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

  // 07 — Відмотати reveal-крок i (сховати)
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

  // 08 — Перехід на секцію (СТЕКІНГ, ADR-010): секції накладаються одна на одну.
  //      Вниз — ціль наповзає знизу (yPercent 100→0) поверх поточної (вона лишається на місці);
  //      вгору — поточна сповзає вниз (0→100), відкриваючи попередню (вона під нею на 0).
  //      dir задає стан кроків нової секції: згори (dir>0) → на початку; знизу (dir<0) → у кінці.
  app.goToSection = (index, instant, dir) => {
    if (!app.sections.length) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const prev = app.currentSectionIndex;
    if (clamped === prev && !instant) return; // межа — нікуди не йдемо

    const target = app.sections[clamped];
    if (clamped > 0) app.passHero(); // йдемо на НЕ-hero → хедер зникає (hero-таймлайн у кінець)

    // Стан кроків/таймлайну нової секції
    if ((target.isOurClients && target.oc) || (target.isProjects && target.pv) || (target.isHSwipe && target.hswipe) || (target.isWP && target.wp)) {
      app.currentStep = 0; // власний стан — у target.oc / target.pv / target.hswipe / target.wp
    } else if (target.isAnimated && target.timeline) {
      const atEnd = dir < 0;                       // вхід знизу → таймлайн у кінці
      target.timeline.progress(atEnd ? 1 : 0).pause();
      app.currentStep = atEnd ? 1 : 0;
    } else if (target.isStepped) {
      const shown = dir < 0;
      app.resetSteps(target, shown);
      app.currentStep = shown ? target.steps.length : 0;
    } else {
      app.currentStep = 0;
    }

    if (instant) {
      app.currentSectionIndex = clamped;
      app.persistSection();
      app.applyStackingPositions();
      if (target.isOurClients && target.oc) target.oc.reset(dir < 0); // миттєвий стан секції
      if (target.isProjects && target.pv) target.pv.reset(dir < 0);   // миттєвий стан свапу відео
      if (target.isHSwipe && target.hswipe) target.hswipe.reset(dir < 0); // миттєвий стан горизонт. свапу
      if (target.isWP && target.wp) target.wp.reset(dir < 0);         // миттєвий стан wp-карток
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      return;
    }

    app.isAnimating = true;
    app.currentSectionIndex = clamped;
    app.persistSection();
    // Відео нової поточної секції — показуємо ОДРАЗУ (грає, поки секція наповзає/відкривається).
    if (app.showCurrentVideo) app.showCurrentVideo();
    const finish = () => {
      app.isAnimating = false;
      // Відео накритих секцій — пауза САМЕ КОЛИ перехід завершився (секція торкнулась верху екрана),
      // а не на початку наповзання. На таблеті/мобілці пауза вже в onComplete кроку 3 (tabletHeroStep).
      if (app.hideOtherVideos) app.hideOtherVideos();
    };
    if (dir > 0) {
      // вниз: проміжні секції (між поточною й ціллю) миттєво в стек — плавний СТРИБОК через кілька
      for (let i = prev + 1; i < clamped; i++) gsap.set(app.sections[i].el, { yPercent: 0 });
      // ціль наповзає знизу поверх поточної
      if (target.isOurClients && target.oc) target.oc.prepare(); // під час наїзду — приховано (прогрес/заголовки)
      if (target.isProjects && target.pv) target.pv.prepare();   // is-projects: приховано до появи (лінія 0)
      if (target.isHSwipe && target.hswipe) target.hswipe.prepare(); // is-our-services: картки приховано
      if (target.isWP && target.wp) target.wp.prepare();            // is-working-process: миттєво стартовий стек
      gsap.to(target.el, {
        yPercent: 0,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => {
          finish();
          if (target.isOurClients && target.oc) target.oc.enter(); // на повному накритті — поява
          if (target.isProjects && target.pv) target.pv.enter();
          if (target.isHSwipe && target.hswipe) target.hswipe.enter(); // is-our-services: картки виїжджають
          if (target.isWP && target.wp) target.wp.enter();          // is-working-process: підтвердити стек
        }
      });
    } else {
      // вгору: проміжні секції (між ціллю й поточною) миттєво під екран — плавний СТРИБОК угору
      for (let i = clamped + 1; i < prev; i++) gsap.set(app.sections[i].el, { yPercent: 100 });
      // поточна сповзає вниз, відкриваючи ціль
      if (target.isOurClients && target.oc) target.oc.reset(true); // секцію відкривають на набір 3 (кінець)
      if (target.isProjects && target.pv) target.pv.reset(true);   // is-projects: відкривають на END-картинці
      if (target.isHSwipe && target.hswipe) target.hswipe.reset(true); // is-our-services: відкривають на останній картці
      if (target.isWP && target.wp) target.wp.reset(true);            // is-working-process: відкривають на останній картці
      // Секція, що сповзає геть → її прогрес-лінія плавно згортається разом із нею (фікс бага)
      const leaving = app.sections[prev];
      if (leaving.isOurClients && leaving.oc && leaving.oc.collapse) leaving.oc.collapse();
      if (leaving.isProjects && leaving.pv && leaving.pv.collapse) leaving.pv.collapse();
      if (leaving.isHSwipe && leaving.hswipe && leaving.hswipe.collapse) leaving.hswipe.collapse();
      if (leaving.isWP && leaving.wp && leaving.wp.collapse) leaving.wp.collapse();
      gsap.to(leaving.el, {
        yPercent: 100,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: finish
      });
    }
    console.log('[Kulbit-Nav] секція', prev, '→', clamped);
  };

  // 08b — Персистентність позиції (sessionStorage): reload (і перебудова брейкпоінта) не скидають
  //        на hero. Зберігаємо при кожному goToSection; відновлюємо в кінці matchMedia-гілки.
  const SECTION_KEY = 'kulbit-section';
  app.persistSection = () => {
    try { sessionStorage.setItem(SECTION_KEY, String(app.currentSectionIndex)); } catch (e) {}
  };
  // Привести hero (секція 0) у КІНЕЦЬ його анімації — хедер ховається ШТАТНО (через таймлайн), а не
  //   зависає (інакше при стрибку/відновленні на не-hero хедер лишався вгорі). Скрол угору на hero
  //   потім коректно відмотає таймлайн і поверне хедер.
  app.passHero = () => {
    const hero = app.sections[0];
    if (!hero) return;
    if (hero.isAnimated && hero.timeline) hero.timeline.progress(1).pause();
    if (hero.isTabletHero && hero.tabletTL) hero.tabletTL.progress(1).pause();
  };
  app.restoreSection = () => {
    let saved = NaN;
    try { saved = parseInt(sessionStorage.getItem(SECTION_KEY), 10); } catch (e) {}
    if (isNaN(saved) || saved <= 0 || saved >= app.sections.length) return; // 0/немає → лишаємось на hero
    app.goToSection(saved, true, 1); // миттєвий перехід на збережену секцію (passHero — всередині goToSection)
    console.log('[Kulbit-Persist] відновлено секцію', saved);
  };

  // 09 — advance: вирішує — наступний КРОК у поточній секції чи перехід на СЕКЦІЮ.
  //      Викликається обробником жесту (02-app-core.js) та кнопками.
  app.advance = (dir) => {
    // Таблет-hero (ADR-011) бере на себе крокування + межу з секцією 1
    const hero = app.sections[0];
    if (hero && hero.isTabletHero && app.tabletHeroStep(dir)) return;

    const section = app.sections[app.currentSectionIndex];

    // is-our-clients (ADR-013, десктоп): покрокова хореографія всередині секції
    if (section.isOurClients && section.oc) {
      if (section.oc.step(dir)) return;                       // крок усередині оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // is-projects (ADR-015, десктоп): свап відео всередині секції
    if (section.isProjects && section.pv) {
      if (section.pv.step(dir)) return;                       // свап усередині оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // is-our-services: горизонтальний свап карток усередині секції
    if (section.isHSwipe && section.hswipe) {
      if (section.hswipe.step(dir)) return;                   // свап усередині оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // is-working-process: stack-cards усередині секції
    if (section.isWP && section.wp) {
      if (section.wp.step(dir)) return;                       // крок карток оброблено
      app.goToSection(app.currentSectionIndex + dir, false, dir); // межа → сусідня секція
      return;
    }

    // Кастомний таймлайн desktop (hero): крок 0 ↔ 1
    if (section.isAnimated && section.timeline) {
      if (dir > 0 && app.currentStep < 1) {
        app.isAnimating = true;
        app.currentStep = 1;
        section.timeline.play();
        console.log('[Kulbit-Anim] ▶ таймлайн секції', section.index);
        return;
      }
      if (dir < 0 && app.currentStep > 0) {
        app.isAnimating = true;
        app.currentStep = 0;
        section.timeline.reverse();
        console.log('[Kulbit-Anim] ◀ reverse секції', section.index);
        return;
      }
    }

    // Reveal-кроки
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

    // Кроків у цьому напрямі немає → міняємо секцію (стекінг)
    app.goToSection(app.currentSectionIndex + dir, false, dir);
  };

  // 09b — Кнопкове автопрогравання (ADR-003): швидко «прокрутити» УСІ кроки анімацій + переходи
  //        секцій по черзі до цільової — як fullpage. Прискорюємо config на час послідовності,
  //        блокуємо ввід (Observer). Зупиняємось щойно дійшли до цільової секції (на її початку).
  app.autoAdvanceTo = (targetIndex) => {
    const t = Math.max(0, Math.min(targetIndex, app.sections.length - 1));
    if (app.autoPlaying || t === app.currentSectionIndex) return;
    const dir = t > app.currentSectionIndex ? 1 : -1;
    app.autoPlaying = true;
    if (app.observer) app.observer.disable();          // ввід OFF на час прогортування
    gsap.globalTimeline.timeScale(3);                  // прискорюємо ВСІ анімації (кроки + переходи) рівномірно
    const finishAuto = () => {
      gsap.globalTimeline.timeScale(1);
      app.autoPlaying = false;
      if (app.observer) app.observer.enable();
      console.log('[Kulbit-Nav] авто-перехід завершено на секції', app.currentSectionIndex);
    };
    let guard = 0;
    const tick = () => {                               // setTimeout — реальний час (не під timeScale)
      if (app.currentSectionIndex === t) { finishAuto(); return; }
      if (++guard > 300) { console.warn('[Kulbit-Nav] авто-перехід: ліміт кроків'); finishAuto(); return; }
      if (app.isAnimating) { setTimeout(tick, 25); return; } // чекаємо завершення поточного кроку
      app.advance(dir);                                      // наступний крок або перехід секції
      setTimeout(tick, 50);
    };
    tick();
  };

  // 10 — Перехід на секцію + конкретний крок (для кнопок data-target-step), стекінг.
  //      Секції 0..clamped виставляємо накладеними (y:0), решту — під екраном (y:100%).
  app.goToSectionStep = (index, targetStep) => {
    if (!app.sections.length) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const section = app.sections[clamped];
    const maxStep = section.isAnimated ? 1 : (section.isStepped ? section.steps.length : 0);
    const step = Math.max(0, Math.min(targetStep || 0, maxStep));

    app.currentSectionIndex = clamped;
    app.currentStep = step;

    // Стекінг-позиції (анімовано)
    app.isAnimating = true;
    let pending = 0;
    app.sections.forEach((s) => {
      pending++;
      gsap.to(s.el, {
        yPercent: s.index <= clamped ? 0 : 100,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => { if (--pending === 0) app.isAnimating = false; }
      });
    });

    // Стан кроків
    if (section.isAnimated && section.timeline) {
      section.timeline.progress(step >= 1 ? 1 : 0).pause();
    } else if (section.isStepped) {
      section.steps.forEach((el, i) => {
        if (i < step) {
          gsap.to(el, { autoAlpha: 1, y: 0, duration: app.config.autoPlayStepDuration, ease: app.config.ease });
        } else {
          gsap.set(el, { autoAlpha: 0, y: 40 });
        }
      });
    }
    console.log('[Kulbit-Nav] → секція', clamped, 'крок', step);
  };
})();
