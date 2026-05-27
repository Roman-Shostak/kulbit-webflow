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
      app.restoreSection();                              // персистентність: відновити позицію (reload/перебудова)
      return () => app.teardownHero();
    });
    app.mm.add('(min-width: 768px) and (max-width: 991px)', () => {       // tablet 768-991
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('tablet');                     // is-our-clients (ADR-013, таблет)
      app.buildProjects('tablet');                       // is-projects: свап вікном 3 (ADR-016 re-approach)
      app.restoreSection();                              // персистентність: відновити позицію
      return () => app.teardownHero();
    });
    app.mm.add('(max-width: 479px)', () => {             // mobile-портрет ≤479
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('mobile');                     // is-our-clients (ADR-013, мобілка: shiftN [2,1,2])
      app.buildProjects('mobile');                       // is-projects: свап вікном 3 (ADR-016 re-approach)
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
    // Заголовки (H2/label): під час наїзду секції приховані (autoAlpha 0); скрамбл-поява —
    // лише на повному накритті (коли секція торкнулась верху екрана). Прогрес — так само.
    const heads = [h2, label].filter(Boolean);
    // Скрамбл заголовків КЕРУЄТЬСЯ ВИДИМІСТЮ У ВЬЮПОРТІ (незалежно від кроків OC):
    //   зʼявився у вьюпорті → скрамбл-IN (порожньо→текст); зник → скрамбл-OUT (текст→порожньо);
    //   знову зʼявився → знову IN. IO не реагує на просте накриття сусідньою секцією (лише на
    //   реальний вихід із вьюпорта). Висота заголовка зафіксована + overflow:hidden (стабільність).
    const makeHeadCtrl = (e) => {
      // Оригінальний HTML заголовка зберігаємо ОДИН раз; при перебудові (поворот/зміна брейкпоінта)
      //   відновлюємо перед парсингом — інакше parseSegments читав би вже спорожнений scramble/setOut
      //   DOM (заголовок зникав, scramble не працював, висота кривилась).
      if (e.dataset.ocOrig == null) e.dataset.ocOrig = e.innerHTML;
      else e.innerHTML = e.dataset.ocOrig;
      e.style.height = ''; e.style.overflow = '';                // скинути перед виміром (перебудова брейкпоінта)
      const targets = buildSegDOM(e, parseSegments(e), true);    // сегментовані спани з текстом (кольори збережено)
      e.style.height = e.offsetHeight + 'px';                    // фіксуємо повну висоту (стабільно при скрамблі)
      e.style.overflow = 'hidden';
      let shown = true, tl = null;
      const animateTo = (show) => {
        if (tl) tl.kill();
        tl = gsap.timeline();
        targets.forEach(([s, t]) => tl.to(s, { duration: 1.2, scrambleText: { text: show ? t : '', ...SC() } }, 0));
        shown = show;
      };
      return {
        el: e,
        show() { if (!shown) animateTo(true); },
        hide() { if (shown) animateTo(false); },
        setOut() { if (tl) tl.kill(); targets.forEach(([s]) => { s.textContent = ''; }); shown = false; }
      };
    };
    const headCtrls = heads.map(makeHeadCtrl);
    headCtrls.forEach((c) => c.setOut()); // старт: порожньо (зʼявляться скрамблом при вході у вьюпорт)
    const headIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const c = headCtrls.find((x) => x.el === en.target);
        if (!c) return;
        if (en.intersectionRatio >= 0.6) c.show();   // зʼявився достатньо → IN
        else if (!en.isIntersecting) c.hide();        // повністю вийшов → OUT
      });
    }, { threshold: [0, 0.6] });
    headCtrls.forEach((c) => headIO.observe(c.el));
    const disarmHeads = () => headIO.disconnect();

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
        dispose() { disarmHeads(); },
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
        dispose() { disarmHeads(); },
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
    if ((target.isOurClients && target.oc) || (target.isProjects && target.pv)) {
      app.currentStep = 0; // власний стан — у target.oc / target.pv (виставляємо в instant/animated нижче)
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
      gsap.to(target.el, {
        yPercent: 0,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => {
          finish();
          if (target.isOurClients && target.oc) target.oc.enter(); // на повному накритті — поява
          if (target.isProjects && target.pv) target.pv.enter();
        }
      });
    } else {
      // вгору: проміжні секції (між ціллю й поточною) миттєво під екран — плавний СТРИБОК угору
      for (let i = clamped + 1; i < prev; i++) gsap.set(app.sections[i].el, { yPercent: 100 });
      // поточна сповзає вниз, відкриваючи ціль
      if (target.isOurClients && target.oc) target.oc.reset(true); // секцію відкривають на набір 3 (кінець)
      if (target.isProjects && target.pv) target.pv.reset(true);   // is-projects: відкривають на END-картинці
      // Секція, що сповзає геть → її прогрес-лінія плавно згортається разом із нею (фікс бага)
      const leaving = app.sections[prev];
      if (leaving.isOurClients && leaving.oc && leaving.oc.collapse) leaving.oc.collapse();
      if (leaving.isProjects && leaving.pv && leaving.pv.collapse) leaving.pv.collapse();
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
