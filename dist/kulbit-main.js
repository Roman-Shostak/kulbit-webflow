/* Kulbit Webflow — production bundle — 2026-05-29T11:20:40.007Z */
(() => {

  if (typeof gsap === 'undefined' || typeof Observer === 'undefined') {

    return;
  }

  gsap.registerPlugin(Observer);

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  if (typeof ScrambleTextPlugin !== 'undefined') {
    gsap.registerPlugin(ScrambleTextPlugin);
  }

})();

(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  app.sections = app.sections || [];
  app.currentSectionIndex = 0;
  app.currentStep = 0;
  app.isAnimating = false;
  app.observer = null;
  app.wrapper = null;
  app.content = null;

  app.config = {
    scrollDuration: 0.7,
    stepDuration: 0.6,
    autoPlayStepDuration: 0.3,
    ease: 'power2.inOut',
    accelRatio: 1.4,
    minVelocity: 60,
    landscapeMaxHeight: 500
  };

  app.lockViewport = () => {
    app.wrapper = document.querySelector('#smooth-wrapper');
    app.content = document.querySelector('#smooth-content');
    if (!app.wrapper || !app.content) {

      return false;
    }
    Object.assign(app.wrapper.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      overflow: 'hidden'
    });
    gsap.set(app.content, { y: 0 });
    window.scrollTo(0, 0);

    return true;
  };

  let flinging = false;
  let prevVel = 0;

  const handleGesture = (dir, self) => {
    const vel = Math.abs(self.velocityY);
    const accelerating = vel > prevVel * app.config.accelRatio && vel > app.config.minVelocity;
    prevVel = vel;

    if (app.isAnimating) return;
    if (flinging && !accelerating) return;

    flinging = true;
    app.advance(dir);
  };

  app.setupObserver = () => {
    if (app.observer) app.observer.kill();

    const gestureDir = (down, self) => {
      const isWheel = self.event && self.event.type === 'wheel';
      return isWheel ? (down ? 1 : -1) : (down ? -1 : 1);
    };
    app.observer = Observer.create({
      target: window,
      type: 'wheel,touch',
      tolerance: 10,
      preventDefault: true,
      onDown: (self) => handleGesture(gestureDir(true, self), self),
      onUp: (self) => handleGesture(gestureDir(false, self), self),
      onStop: () => { flinging = false; prevVel = 0; }
    });

  };

  let resizeTimer = null;
  app.handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!app.isAnimating && app.applyStackingPositions) {
        app.applyStackingPositions();

      }
    }, 150);
  };

  app.init = () => {

    if (typeof ScrollSmoother !== 'undefined' && ScrollSmoother.get()) {
      ScrollSmoother.get().kill();

    }

    if (!app.lockViewport()) return;
    app.registerSections();
    app.setupStacking();
    app.registerSteps();
    app.registerAnimations();
    app.setupObserver();
    window.addEventListener('resize', app.handleResize);

  };

  document.addEventListener('DOMContentLoaded', () => app.init());
})();

(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  const ANIM_SELECTOR = '[data-kulbit-y],[data-kulbit-scale],[data-kulbit-fade]';
  const num = (el, attr, fallback) => {
    const v = parseFloat(el.getAttribute(attr));
    return Number.isNaN(v) ? fallback : v;
  };

  app.registerSections = () => {
    const els = document.querySelectorAll('[data-kulbit-section]');
    app.sections = Array.from(els).map((el, index) => {
      el.setAttribute('data-section-index', index);
      return {
        el, index,
        isFooter: el.classList.contains('footer'),
        steps: [], isStepped: false,
        timeline: null, isAnimated: false,
        tabletTL: null, isTabletHero: false,
        oc: null, isOurClients: false,
        pv: null, isProjects: false
      };
    });

    if (!app.sections.length) {

      return;
    }

  };

  app.registerSteps = () => {
    app.sections.forEach((s) => {
      const stepEls = s.el.querySelectorAll('[data-kulbit-step]');
      stepEls.forEach((el, i) => el.setAttribute('data-step-index', i));
      s.steps = Array.from(stepEls);
      s.isStepped = s.steps.length > 0;
      if (s.isStepped) {
        app.resetSteps(s, false);

      }
    });
  };

  app.registerAnimations = () => {
    if (app.mm) app.mm.kill();
    app.mm = gsap.matchMedia();

    app.mm.add('(min-width: 992px)', () => {
      app.resetHeroState();
      app.buildDesktopAnimations();
      app.buildOurClients('desktop');
      app.buildProjects('desktop');
      app.buildHSwipe('desktop');
      app.buildWorkingProcess('desktop');
      app.restoreSection();
      return () => app.teardownHero();
    });
    app.mm.add('(min-width: 768px) and (max-width: 991px)', () => {
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('tablet');
      app.buildProjects('tablet');
      app.buildHSwipe('tablet');
      app.buildWorkingProcess('tablet');
      app.restoreSection();
      return () => app.teardownHero();
    });
    app.mm.add('(max-width: 479px)', () => {
      app.resetHeroState();
      app.buildTabletHero();
      app.buildOurClients('mobile');
      app.buildProjects('mobile');
      app.buildHSwipe('mobile');
      app.buildWorkingProcess('mobile');
      app.restoreSection();
      return () => app.teardownHero();
    });

  };

  app.resetHeroState = () => {
    app.currentSectionIndex = 0;
    app.currentStep = 0;
    app.isAnimating = false;
    app.applyStackingPositions();
    if (app.updateVideoVisibility) app.updateVideoVisibility();
  };

  app.teardownHero = () => {
    if (app._heroVidCleanup) { app._heroVidCleanup(); app._heroVidCleanup = null; }
    app.sections.forEach((s) => {
      s.timeline = null; s.isAnimated = false;
      s.tabletTL = null; s.isTabletHero = false;
      if (s.oc && s.oc.dispose) s.oc.dispose();
      s.oc = null; s.isOurClients = false;
      if (s.pv && s.pv.dispose) s.pv.dispose();
      s.pv = null; s.isProjects = false;
      if (s.hswipe && s.hswipe.dispose) s.hswipe.dispose();
      s.hswipe = null; s.isHSwipe = false;
      if (s.wp && s.wp.dispose) s.wp.dispose();
      s.wp = null; s.isWP = false;
    });

  };

  app.buildDesktopAnimations = () => {
    const animEls = document.querySelectorAll(ANIM_SELECTOR);
    if (!animEls.length) return;

    const bySection = new Map();
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

    });
  };

  app.buildTabletHero = () => {
    const hero = app.sections[0];
    const section2 = app.sections[1] && app.sections[1].el;
    if (!hero || !section2) {  return; }
    const heroVideo = hero.el.querySelector('.hero-video');
    if (!heroVideo) {  return; }
    const btn = hero.el.querySelector('.hero-video-button');

    const STEP = app.config.stepDuration, SCROLL = app.config.scrollDuration, EASE = app.config.ease;
    const SUF = '-tablet';
    const has = (el, n) => el.hasAttribute('data-kulbit-' + n + SUF);
    const v = (el, n, fb) => num(el, 'data-kulbit-' + n + SUF, fb);
    const sel = `[data-kulbit-y${SUF}],[data-kulbit-scale${SUF}],[data-kulbit-fade${SUF}]`;
    const header = document.querySelector('[data-kulbit-header]');
    const els = [...hero.el.querySelectorAll(sel)];
    if (header && header.matches(sel)) els.push(header);

    els.forEach((el) => {
      const s = {};
      if (has(el, 'y')) s.yPercent = 0;
      if (has(el, 'scale')) { s.scale = v(el, 'scale-from', 1); s.transformOrigin = '50% 50%'; }
      if (has(el, 'fade')) s.autoAlpha = 1;
      gsap.set(el, s);
    });

    const fullVideoH = () => (window.visualViewport && window.visualViewport.height) ||
                             (app.wrapper ? app.wrapper.clientHeight : window.innerHeight);
    const syncHeroVideoFull = () => {
      if (app.currentSectionIndex === 0 && app.currentStep === 0) gsap.set(heroVideo, { height: fullVideoH() });
    };
    gsap.set(heroVideo, { bottom: 'auto', height: fullVideoH() });
    gsap.set(section2, { yPercent: 100 });
    if (btn) gsap.set(btn, { y: 0 });

    const video16h = Math.round(heroVideo.clientWidth * 9 / 16);
    const partial = (video16h / section2.offsetHeight) * 100;

    const visibleH = app.wrapper ? app.wrapper.clientHeight : window.innerHeight;

    let btnYScreen = 0, btnY16 = 0;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const btnCenter = r.top + r.height / 2;
      btnYScreen = (visibleH / 2) - btnCenter;
      btnY16 = (video16h / 2) - btnCenter;
    }

    const tl = gsap.timeline({ paused: true });
    els.forEach((el) => {
      const to = { duration: STEP, ease: EASE };
      if (has(el, 'y')) to.yPercent = v(el, 'y', 0);
      if (has(el, 'scale')) to.scale = v(el, 'scale', 1);
      if (has(el, 'fade')) to.autoAlpha = v(el, 'fade', 0);
      tl.to(el, to, 0);
    });
    if (btn) tl.to(btn, { y: btnYScreen, duration: STEP, ease: EASE }, 0);
    tl.addLabel('s1');
    tl.to(heroVideo, { height: video16h, duration: STEP, ease: EASE }, 's1');
    tl.to(section2, { yPercent: partial, duration: STEP, ease: EASE }, 's1');
    if (btn) tl.to(btn, { y: btnY16, duration: STEP, ease: EASE }, 's1');
    tl.addLabel('s2');
    tl.to(section2, { yPercent: 0, duration: SCROLL, ease: EASE }, 's2');
    tl.addLabel('s3');

    hero.tabletTL = tl;
    hero.isTabletHero = true;
    app.currentStep = 0;

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
    setTimeout(syncHeroVideoFull, 250);

  };

  app.tabletHeroStep = (dir) => {
    const hero = app.sections[0];
    const tl = hero.tabletTL;
    const labels = [0, 's1', 's2', 's3'], MAX = 3;
    const idx = app.currentSectionIndex;

    if (idx === 0) {
      if (dir > 0 && app.currentStep < MAX) {
        app.isAnimating = true;
        const ns = app.currentStep + 1;
        tl.tweenTo(labels[ns], { onComplete: () => {
          app.isAnimating = false;
          if (ns === MAX) {
            app.currentSectionIndex = 1; app.currentStep = 0;
            app.persistSection();
            if (app.updateVideoVisibility) app.updateVideoVisibility();
            const s1 = app.sections[1];
            if (s1 && s1.isOurClients && s1.oc) s1.oc.enter();
          } else app.currentStep = ns;
        } });
      } else if (dir < 0 && app.currentStep > 0) {
        app.isAnimating = true;
        const ns = app.currentStep - 1;
        tl.tweenTo(labels[ns], { onComplete: () => { app.isAnimating = false; app.currentStep = ns; } });
      }
      return true;
    }
    if (idx === 1 && dir < 0) {
      const s1 = app.sections[1];

      if (s1 && s1.isOurClients && s1.oc && s1.oc.state > 0) return false;

      app.isAnimating = true;
      app.currentSectionIndex = 0;
      app.persistSection();
      if (s1 && s1.isOurClients && s1.oc) s1.oc.prepare();
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      tl.tweenTo(labels[MAX - 1], { onComplete: () => { app.isAnimating = false; app.currentStep = MAX - 1; } });
      return true;
    }
    return false;
  };

  app.buildOurClients = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-our-clients'));
    if (!section) return;
    const el = section.el;
    const wraps = [...el.querySelectorAll('.our-client-card-wrapper')];
    if (wraps.length < 2) {  return; }
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

    paraWraps.forEach((w) => { w.style.height = ''; w.style.height = w.offsetHeight + 'px'; });

    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.backgroundColor = 'rgba(253, 252, 252, 0.15)';
      fill = bar.querySelector('.oc-fill');
      if (!fill) { fill = document.createElement('div'); fill.className = 'oc-fill'; bar.appendChild(fill); }
      Object.assign(fill.style, { position: 'absolute', left: '0', top: '0', height: '100%', width: '0%', backgroundColor: '#fdfcfc' });
      gsap.set(fill, { width: '0%' });
    }

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

    const setFill = (prog, animate) => {
      if (!fill) return;
      const w = ((prog + 1) / NW * 100) + '%';
      if (animate) gsap.to(fill, { width: w, duration: STEP, ease: EASE });
      else gsap.set(fill, { width: w });
    };

    const prepareCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } };
    const enterCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } setFill(0, true); };
    const collapseCommon = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } };
    const showCommon = () => {};

    section.isOurClients = true;

    if (mode === 'tablet' || mode === 'mobile') {

      const shiftN = (mode === 'mobile') ? [2, 1, 2] : [1, 0, 1];
      const cardStep = wraps.map((w) => {
        const c = cardsOf(w);
        return c.length > 1 ? (c[1].getBoundingClientRect().top - c[0].getBoundingClientRect().top) : 0;
      });

      const STAGES = (() => {
        const arr = [];
        const acc = new Array(NW).fill(0);
        arr.push({ cur: 0, shifts: acc.slice() });
        for (let i = 0; i < NW; i++) {
          if ((shiftN[i] || 0) > 0) { acc[i] = shiftN[i]; arr.push({ cur: i, shifts: acc.slice() }); }
          if (i < NW - 1) arr.push({ cur: i + 1, shifts: acc.slice() });
        }
        return arr;
      })();
      const MAXST = STAGES.length - 1;
      const scrIdx = STAGES.findIndex((s) => s.cur === NW - 1);
      const applyStage = (s, animate) => {
        const d = STAGES[s];
        wraps.forEach((w, i) => {
          const yp = i < d.cur ? -100 : (i > d.cur ? 100 : 0);
          const cy = -d.shifts[i] * cardStep[i];
          if (animate) { gsap.to(w, { yPercent: yp, duration: STEP, ease: EASE }); gsap.to(cardsOf(w), { y: cy, duration: STEP, ease: EASE }); }
          else { gsap.set(w, { yPercent: yp }); gsap.set(cardsOf(w), { y: cy }); }
        });
        setFill(d.cur, animate);
      };
      let stage = 0;
      applyStage(0, false); setTexts(false); prepareCommon();
      section.oc = {
        get state() { return stage; },
        prepare() { stage = 0; applyStage(0, false); setTexts(false); prepareCommon(); },
        reset(toEnd) { stage = toEnd ? MAXST : 0; applyStage(stage, false); setTexts(stage >= scrIdx); showCommon(); },
        enter() { stage = 0; applyStage(0, false); enterCommon(); },
        collapse() { collapseCommon(); },
        dispose() {},
        step(dir) {
          const ns = Math.max(0, Math.min(MAXST, stage + dir));
          if (ns === stage) return false;
          const prev = stage; stage = ns;
          app.isAnimating = true;
          applyStage(stage, true);
          gsap.delayedCall(STEP, () => { app.isAnimating = false; });
          if (prev < scrIdx && stage >= scrIdx) morphTexts(true);
          if (prev >= scrIdx && stage < scrIdx) morphTexts(false);
          return true;
        }
      };

    } else {

      const setCards = (s, animate) => wraps.forEach((w, i) => {
        const y = i < s ? -100 : (i > s ? 100 : 0);
        if (animate) gsap.to(w, { yPercent: y, duration: STEP, ease: EASE });
        else gsap.set(w, { yPercent: y });
      });
      let state = 0;
      setCards(0, false); setTexts(false); prepareCommon();
      section.oc = {
        get state() { return state; },
        prepare() { state = 0; setCards(0, false); setTexts(false); prepareCommon(); },
        reset(toEnd) { state = toEnd ? NW - 1 : 0; setCards(state, false); setFill(state, false); setTexts(state === NW - 1); showCommon(); },
        enter() { state = 0; setCards(0, false); enterCommon(); },
        collapse() { collapseCommon(); },
        dispose() {},
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

    }
  };

  app.buildProjects = (mode) => {
    const group = document.querySelector('[data-kulbit-project-group]');
    if (!group) return;
    const section = app.sections.find((s) => s.el.contains(group));
    if (!section) {  return; }

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
    if (total < 2) {  return; }

    const WIN = isDesktop ? 1 : Math.min(3, total);
    const maxState = total - WIN;

    if (!isDesktop) gsap.set(els, { flex: 'none' });

    const slotHeight = () => {
      const wrapper = app.wrapper || document.querySelector('#smooth-wrapper');
      const wrapperH = wrapper ? wrapper.clientHeight : window.innerHeight;
      const gTop = group.getBoundingClientRect().top - section.el.getBoundingClientRect().top;
      const padB = parseFloat(getComputedStyle(section.el).paddingBottom) || 0;
      const availH = wrapperH - gTop - padB;
      return (availH - (WIN - 1) * gap()) / WIN;
    };

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
    const prepareFill  = () => { if (fill) { gsap.killTweensOf(fill); gsap.set(fill, { width: '0%' }); } };
    const enterFill    = () => { prepareFill(); setFill(0, true); };
    const collapseFill = () => { if (fill) { gsap.killTweensOf(fill); gsap.to(fill, { width: '0%', duration: STEP, ease: EASE }); } };

    const resetItem = (rec) => {
      if (!rec.isVideo) return;
      if (rec.player)   { rec.player.pause(); rec.player.setCurrentTime(0); }
      if (rec.poster)   gsap.set(rec.poster,  { autoAlpha: 1 });
      if (rec.bigPlay)  gsap.set(rec.bigPlay, { autoAlpha: 1 });
      if (rec.controls) rec.controls.style.display = 'none';
    };
    const resetOthers = (active) => items.forEach((r, i) => { if (i !== active) resetItem(r); });

    const offsetFor = (s) => -s * gap();

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

    const applyState = (s) => { setHeights(s, false); moveColumn(s, false); };

    let state = 0;
    applyState(0); resetOthers(0); prepareFill();

    section.isProjects = true;
    section.pv = {
      get state() { return state; },
      prepare() { state = 0; applyState(0); resetOthers(0); prepareFill(); },
      enter()   { state = 0; applyState(0); resetOthers(0); enterFill(); },
      collapse() { collapseFill(); },
      reset(toEnd) { state = toEnd ? maxState : 0; applyState(state); setFill(state, false); resetOthers(state); },

      dispose() { group.style.overflow = ''; gsap.set(els, { clearProps: 'height,transform,flex' }); if (fill) fill.remove(); },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false;
        const goingDown = ns > state;
        const out = goingDown ? items[state] : items[state + WIN - 1];
        state = ns;
        app.isAnimating = true;
        resetItem(out);
        setHeights(ns, true);
        moveColumn(ns, true);
        setFill(ns, true);
        gsap.delayedCall(STEP, () => { app.isAnimating = false; });
        return true;
      }
    };

  };

  app.buildHSwipe = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-our-services'));
    if (!section) return;
    const group = section.el.querySelector('[data-kulbit-hswipe-group]');
    if (!group) return;
    const cards = [...group.children];
    const total = cards.length;
    if (total < 2) {  return; }

    const STEP = app.config.scrollDuration, EASE = app.config.ease;
    const RISE = 60;
    const maxState = total;
    const swapIndexOf = (s) => Math.max(0, s - 1);
    const gap = () => parseFloat(getComputedStyle(group).columnGap) || 0;
    const cardW = () => cards[0].getBoundingClientRect().width;
    const shiftFor = (s) => -swapIndexOf(s) * (cardW() + gap());

    const label = section.el.querySelector('.text-size-section-label');
    const h2 = section.el.querySelector('.text-size-section-h2');
    const isMobile = mode === 'mobile';
    const titleWrap = label ? label.closest('.flex-h-v-v') : null;
    const scrambleEls = (isMobile ? [label, h2] : [h2]).filter(Boolean);
    let origH2 = 0;
    let groupMT = 0;
    const measureTitle = () => { if (!isMobile && h2) origH2 = parseFloat(h2.style.height) || h2.offsetHeight; };
    const setTitle = (collapsed, animate) => {
      scrambleEls.forEach((el) => { const c = app.scrambles && app.scrambles.get(el); if (c) { collapsed ? c.out() : c.in(); } });
      if (isMobile) {

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

      if (!h2) return;
      const h = collapsed ? 0 : origH2;
      if (collapsed) groupMT = parseFloat(getComputedStyle(group).marginTop) || 0;
      if (animate) {
        gsap.to(h2, { height: h, duration: STEP, ease: EASE });
        if (collapsed) gsap.to(group, { marginTop: 0, duration: STEP, ease: EASE });
        else gsap.to(group, { marginTop: groupMT, duration: STEP, ease: EASE, onComplete: () => gsap.set(group, { marginTop: '' }) });
      } else {
        gsap.set(h2, { height: h });
        gsap.set(group, { marginTop: collapsed ? 0 : '' });
      }
    };

    const bar = section.el.querySelector('.section-progresbar');
    let fill = null;
    if (bar) {
      bar.style.position = 'relative';
      bar.style.flexShrink = '0';
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
    measureTitle();
    moveX(0, false); setTitle(false, false); hideCards(); prepareFill();

    section.isHSwipe = true;
    section.hswipe = {
      get state() { return state; },
      prepare() { state = 0; moveX(0, false); setTitle(false, false); hideCards(); prepareFill(); },
      enter()   { state = 0; measureTitle(); moveX(0, false); setTitle(false, false); showCards(); enterFill(); },
      collapse() { collapseFill(); },
      reset(toEnd) { state = toEnd ? maxState : 0; moveX(state, false); setTitle(state >= 1, false); gsap.set(group, { autoAlpha: 1, y: 0 }); setFill(state, false); },
      dispose() { gsap.set(group, { clearProps: 'transform,opacity,visibility,willChange' }); if (h2) h2.style.height = ''; gsap.set([bar, titleWrap].filter(Boolean), { clearProps: 'opacity,visibility' }); if (fill) fill.remove(); },
      step(dir) {
        const ns = Math.max(0, Math.min(maxState, state + dir));
        if (ns === state) return false;
        const prev = state; state = ns;
        app.isAnimating = true;

        if (prev === 0 && ns >= 1) setTitle(true, true);
        else if (prev >= 1 && ns === 0) setTitle(false, true);
        moveX(ns, true);
        setFill(ns, true);
        gsap.delayedCall(STEP, () => { app.isAnimating = false; });
        return true;
      }
    };

  };

  app.buildWorkingProcess = (mode) => {
    const section = app.sections.find((s) => s.el.classList.contains('is-working-process'));
    if (!section) return;
    const sec = section.el;
    const cards = [...sec.querySelectorAll('.working-process-card')];
    if (cards.length < 2) {  return; }

    const NS = 'http://www.w3.org/2000/svg';
    const VERTICAL = mode !== 'desktop';
    const FALL_X = VERTICAL ? 0 : -50, FALL_Y = VERTICAL ? 100 : 50, FALL_ROT = -10;
    const STACK_X = VERTICAL ? 0 : 50, STACK_SS = VERTICAL ? 0.05 : 0.15, DARK = 0.4;
    const Z_VALUES = [75, 50, 25];
    const DUR_FALL = 0.9, DUR_SLIDE = 0.75, EASE = 'power1.inOut';
    const DUR_BG = 0.7, DUR_ARROW = 0.4, DUR_LABEL = 0.5, WK_STAG = 0.1, WK_DUR = 0.4;
    const DUR_BLUE = 0.7, DUR_RED = 0.45, DUR_AWHITE = 0.6, DUR_GRAD = 0.6, DUR_DOTCOL = 0.3, DUR_CARDSWRAP = 0.5;
    const WHITE_END_GAP = 5;
    const REV_SPEED = 5;
    const REVEAL_SPEED = 1.7;
    const WHITE10 = (getComputedStyle(sec).getPropertyValue('--colors--white-10') || '').trim() || '#fdfcfc';

    const maxState = cards.length - 1;
    const ovOf = (c) => c.querySelector('.kulbit-wp-overlay');
    const cardW = cards[0].getBoundingClientRect().width;

    const labelWrap   = sec.querySelector('.working-process-label-wrapper:not(.is-second)');
    const labelSecond = sec.querySelector('.working-process-label-wrapper.is-second');
    const weeks       = [...sec.querySelectorAll('.working-process-week')];
    const cardsWrapper = sec.querySelector('.working-process-cards-wrapper');

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

    const svgs = [...sec.querySelectorAll('svg')];
    const svg = svgs.find((s) => s.querySelector('[data-kulbit-svg-line]') && s.getBoundingClientRect().width > 1 && s.offsetParent !== null)
             || svgs.find((s) => s.querySelector('[data-kulbit-svg-line]') && s.getBoundingClientRect().width > 1) || null;

    const cleanSVG = () => {
      if (!svg) return;
      [...svg.querySelectorAll('clipPath')].forEach((cp) => { if (cp.id && cp.id.indexOf('wpClip') === 0) cp.remove(); });
      [...svg.querySelectorAll('[id^="wpW"]')].forEach((el) => el.remove());
    };
    cleanSVG();

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

      greyStroke = dotByN(1) ? getComputedStyle(dotByN(1)).stroke : null;
      greyHead = arrowGroup(1).head ? getComputedStyle(arrowGroup(1).head).fill : null;

      const makeClip = (id, x0) => {
        const cp = document.createElementNS(NS, 'clipPath'); cp.setAttribute('id', id); cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const rc = document.createElementNS(NS, 'rect'); rc.setAttribute('x', '0'); rc.setAttribute('y', '0'); rc.setAttribute('width', String(x0)); rc.setAttribute('height', String(H));
        cp.appendChild(rc); svg.appendChild(cp); return rc;
      };

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

    const htmlEls = [labelWrap, labelSecond, ...weeks].filter(Boolean);
    if (htmlEls.length) gsap.set(htmlEls, { autoAlpha: 0, y: 40 });
    if (cardsWrapper) gsap.set(cardsWrapper, { autoAlpha: 0, y: 40 });

    let state = 0;

    const cardVars = (i, s) => {
      const rank = i - s;
      if (rank < 0) return { card: { xPercent: FALL_X, yPercent: FALL_Y, scale: 1, rotation: FALL_ROT, opacity: 0 }, ov: { opacity: 0 } };
      if (rank === 0) return { card: { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }, ov: { opacity: 0 } };
      return { card: { xPercent: STACK_X * rank, yPercent: 0, scale: 1 - STACK_SS * rank, rotation: 0, opacity: 1 }, ov: { opacity: DARK * rank } };
    };
    const resetCardsToStart = () => {
      cards.forEach((c) => { gsap.set(c, { xPercent: 0, yPercent: 0, scale: 1, rotation: 0, opacity: 1 }); const ov = ovOf(c); if (ov) gsap.set(ov, { opacity: 0 }); });
    };
    resetCardsToStart();

    const setStepSVGInstant = (s) => {
      arrowNums.forEach((n) => {
        if (n < 2) return;
        const drawn = n <= s + 1; const wc = whiteClones[n]; const g = arrowGroup(n);
        if (wc) gsap.set(wc.el, { strokeDashoffset: drawn ? WHITE_END_GAP : wc.len });
        if (g.fill) gsap.set(g.fill, { autoAlpha: drawn ? 1 : 0 });
        if (g.head && greyHead) gsap.set(g.head, { fill: drawn ? WHITE10 : greyHead });
      });
      dotRings.forEach((r) => { const n = +r.getAttribute('data-kulbit-svg-dot'); if (n < 3 || n >= dotRings.length || !greyStroke) return; gsap.set(r, { stroke: n <= s + 2 ? WHITE10 : greyStroke }); });
    };
    setStepSVGInstant(0);

    const setStateInstant = (s) => {
      cards.forEach((c, i) => { const v = cardVars(i, s); gsap.set(c, v.card); const ov = ovOf(c); if (ov) gsap.set(ov, v.ov); });
      setStepSVGInstant(s);
      state = s;
    };

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

    let stepTL = null;
    const stepTo = (target) => {
      target = Math.max(0, Math.min(maxState, target));
      if (target === state) return false;
      const dir = target > state ? 1 : -1;
      const hi = Math.max(state, target);
      const arrowN = hi + 1, dotN = hi + 2;
      if (stepTL) stepTL.kill();
      app.isAnimating = true;
      stepTL = gsap.timeline({ onComplete: () => { app.isAnimating = false; } });

      cards.forEach((c, i) => {
        const v = cardVars(i, target); const ov = ovOf(c); const dur = (i - target) < 0 ? DUR_FALL : DUR_SLIDE;
        stepTL.to(c, Object.assign({ duration: dur, ease: EASE }, v.card), 0);
        if (ov) stepTL.to(ov, Object.assign({ duration: dur, ease: EASE }, v.ov), 0);
      });

      if (svg) {
        const wc = whiteClones[arrowN], g = arrowGroup(arrowN), dotEl = (dotN < dotRings.length) ? dotByN(dotN) : null;
        if (dir > 0) {
          if (wc) stepTL.to(wc.el, { strokeDashoffset: WHITE_END_GAP, duration: DUR_SLIDE, ease: EASE }, 0);
          if (g.fill) stepTL.to(g.fill, { autoAlpha: 1, duration: DUR_SLIDE, ease: 'power1.out' }, 0);
          if (g.head && greyHead) stepTL.to(g.head, { fill: WHITE10, duration: DUR_SLIDE * 0.55, ease: EASE }, DUR_SLIDE * 0.45);
          if (dotEl && greyStroke) stepTL.to(dotEl, { stroke: WHITE10, duration: DUR_DOTCOL, ease: 'power1.out' }, DUR_SLIDE);
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
      prepare() {
        if (stepTL) stepTL.kill();
        state = 0;
        revealTL.timeScale(1).pause(0);
        resetCardsToStart();
        setStepSVGInstant(0);
      },
      enter() {
        app.isAnimating = true;
        revealTL.timeScale(REVEAL_SPEED).play();
      },
      collapse() { revealTL.timeScale(REV_SPEED).reverse(); },
      reset(toEnd) {
        if (stepTL) stepTL.kill();
        revealTL.timeScale(1).progress(1).pause();
        setStateInstant(toEnd ? maxState : 0);
      },
      dispose() {
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
        if (ns === state) return false;
        return stepTo(ns);
      }
    };

  };

  app.buildSectionTimeline = (els) => {

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

  app.setupStacking = () => {
    if (app.content) {
      app.content.style.position = 'relative';
      app.content.style.height = '100vh';
    }
    app.sections.forEach((s) => {
      Object.assign(s.el.style, {
        position: 'absolute', top: '0', left: '0', width: '100%', height: '100vh'
      });
      s.el.style.zIndex = String(s.index);
    });
    app.applyStackingPositions();

  };

  app.applyStackingPositions = () => {
    app.sections.forEach((s) => {
      gsap.set(s.el, { yPercent: s.index <= app.currentSectionIndex ? 0 : 100 });
    });
  };

  app.resetSteps = (section, shown) => {
    if (!section.isStepped) return;
    section.steps.forEach((el) => {
      gsap.set(el, shown ? { autoAlpha: 1, y: 0 } : { autoAlpha: 0, y: 40 });
    });
  };

  app.playStep = (section, i) => {
    const el = section.steps[i];
    if (!el) return;
    app.isAnimating = true;
    gsap.to(el, {
      autoAlpha: 1, y: 0,
      duration: app.config.stepDuration, ease: app.config.ease,
      onComplete: () => { app.isAnimating = false; }
    });

  };

  app.reverseStep = (section, i) => {
    const el = section.steps[i];
    if (!el) return;
    app.isAnimating = true;
    gsap.to(el, {
      autoAlpha: 0, y: 40,
      duration: app.config.stepDuration, ease: app.config.ease,
      onComplete: () => { app.isAnimating = false; }
    });

  };

  app.goToSection = (index, instant, dir) => {
    if (!app.sections.length) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const prev = app.currentSectionIndex;
    if (clamped === prev && !instant) return;

    const target = app.sections[clamped];
    if (clamped > 0) app.passHero();

    if ((target.isOurClients && target.oc) || (target.isProjects && target.pv) || (target.isHSwipe && target.hswipe) || (target.isWP && target.wp)) {
      app.currentStep = 0;
    } else if (target.isAnimated && target.timeline) {
      const atEnd = dir < 0;
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
      if (target.isOurClients && target.oc) target.oc.reset(dir < 0);
      if (target.isProjects && target.pv) target.pv.reset(dir < 0);
      if (target.isHSwipe && target.hswipe) target.hswipe.reset(dir < 0);
      if (target.isWP && target.wp) target.wp.reset(dir < 0);
      if (app.updateVideoVisibility) app.updateVideoVisibility();
      return;
    }

    app.isAnimating = true;
    app.currentSectionIndex = clamped;
    app.persistSection();

    if (app.showCurrentVideo) app.showCurrentVideo();
    const finish = () => {
      app.isAnimating = false;

      if (app.hideOtherVideos) app.hideOtherVideos();
    };
    if (dir > 0) {

      for (let i = prev + 1; i < clamped; i++) gsap.set(app.sections[i].el, { yPercent: 0 });

      if (target.isOurClients && target.oc) target.oc.prepare();
      if (target.isProjects && target.pv) target.pv.prepare();
      if (target.isHSwipe && target.hswipe) target.hswipe.prepare();
      if (target.isWP && target.wp) target.wp.prepare();
      gsap.to(target.el, {
        yPercent: 0,
        duration: app.config.scrollDuration, ease: app.config.ease,
        onComplete: () => {
          finish();
          if (target.isOurClients && target.oc) target.oc.enter();
          if (target.isProjects && target.pv) target.pv.enter();
          if (target.isHSwipe && target.hswipe) target.hswipe.enter();
          if (target.isWP && target.wp) target.wp.enter();
        }
      });
    } else {

      for (let i = clamped + 1; i < prev; i++) gsap.set(app.sections[i].el, { yPercent: 100 });

      if (target.isOurClients && target.oc) target.oc.reset(true);
      if (target.isProjects && target.pv) target.pv.reset(true);
      if (target.isHSwipe && target.hswipe) target.hswipe.reset(true);
      if (target.isWP && target.wp) target.wp.reset(true);

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

  };

  const SECTION_KEY = 'kulbit-section';
  app.persistSection = () => {
    try { sessionStorage.setItem(SECTION_KEY, String(app.currentSectionIndex)); } catch (e) {}
  };

  app.passHero = () => {
    const hero = app.sections[0];
    if (!hero) return;
    if (hero.isAnimated && hero.timeline) hero.timeline.progress(1).pause();
    if (hero.isTabletHero && hero.tabletTL) hero.tabletTL.progress(1).pause();
  };
  app.restoreSection = () => {
    let saved = NaN;
    try { saved = parseInt(sessionStorage.getItem(SECTION_KEY), 10); } catch (e) {}
    if (isNaN(saved) || saved <= 0 || saved >= app.sections.length) return;
    app.goToSection(saved, true, 1);

  };

  app.advance = (dir) => {

    const hero = app.sections[0];
    if (hero && hero.isTabletHero && app.tabletHeroStep(dir)) return;

    const section = app.sections[app.currentSectionIndex];

    if (section.isOurClients && section.oc) {
      if (section.oc.step(dir)) return;
      app.goToSection(app.currentSectionIndex + dir, false, dir);
      return;
    }

    if (section.isProjects && section.pv) {
      if (section.pv.step(dir)) return;
      app.goToSection(app.currentSectionIndex + dir, false, dir);
      return;
    }

    if (section.isHSwipe && section.hswipe) {
      if (section.hswipe.step(dir)) return;
      app.goToSection(app.currentSectionIndex + dir, false, dir);
      return;
    }

    if (section.isWP && section.wp) {
      if (section.wp.step(dir)) return;
      app.goToSection(app.currentSectionIndex + dir, false, dir);
      return;
    }

    if (section.isAnimated && section.timeline) {
      if (dir > 0 && app.currentStep < 1) {
        app.isAnimating = true;
        app.currentStep = 1;
        section.timeline.play();

        return;
      }
      if (dir < 0 && app.currentStep > 0) {
        app.isAnimating = true;
        app.currentStep = 0;
        section.timeline.reverse();

        return;
      }
    }

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

    app.goToSection(app.currentSectionIndex + dir, false, dir);
  };

  app.autoAdvanceTo = (targetIndex) => {
    const t = Math.max(0, Math.min(targetIndex, app.sections.length - 1));
    if (app.autoPlaying || t === app.currentSectionIndex) return;
    const dir = t > app.currentSectionIndex ? 1 : -1;
    app.autoPlaying = true;
    if (app.observer) app.observer.disable();
    gsap.globalTimeline.timeScale(3);
    const finishAuto = () => {
      gsap.globalTimeline.timeScale(1);
      app.autoPlaying = false;
      if (app.observer) app.observer.enable();

    };
    let guard = 0;
    const tick = () => {
      if (app.currentSectionIndex === t) { finishAuto(); return; }
      if (++guard > 300) {  finishAuto(); return; }
      if (app.isAnimating) { setTimeout(tick, 25); return; }
      app.advance(dir);
      setTimeout(tick, 50);
    };
    tick();
  };

  app.goToSectionStep = (index, targetStep) => {
    if (!app.sections.length) return;

    const clamped = Math.max(0, Math.min(index, app.sections.length - 1));
    const section = app.sections[clamped];
    const maxStep = section.isAnimated ? 1 : (section.isStepped ? section.steps.length : 0);
    const step = Math.max(0, Math.min(targetStep || 0, maxStep));

    app.currentSectionIndex = clamped;
    app.currentStep = step;

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

  };
})();

(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  const resolveIndex = (target) => {
    if (target === null) return -1;
    if (/^\d+$/.test(target)) return parseInt(target, 10);
    const found = app.sections.find((s) => s.el.getAttribute('data-section-name') === target);
    return found ? found.index : -1;
  };

  const onClick = (e) => {
    const trigger = e.target.closest('[data-target-section]');
    if (!trigger) return;
    e.preventDefault();

    const index = resolveIndex(trigger.getAttribute('data-target-section'));
    if (index < 0) {

      return;
    }

    const stepAttr = trigger.getAttribute('data-target-step');
    if (stepAttr !== null) {

      app.goToSectionStep(index, parseInt(stepAttr, 10));
    } else {

      app.autoAdvanceTo(index);
    }
  };

  document.addEventListener('click', onClick);

})();

(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  document.addEventListener('DOMContentLoaded', () => {
    const popup = document.querySelector('[data-kulbit-landscape-popup]');
    if (!popup) {

      return;
    }

    const maxH = (app.config && app.config.landscapeMaxHeight) || 500;
    const mql = window.matchMedia(
      `(orientation: landscape) and (max-height: ${maxH}px) and (pointer: coarse)`
    );

    const apply = () => {

      if (app.videoFullscreen) {
        app.landscapeBlocked = false;
        popup.style.display = 'none';

        return;
      }
      if (mql.matches) {

        app.landscapeBlocked = true;
        popup.style.display = 'flex';
        if (app.observer) app.observer.disable();
        if (app.updateVideoVisibility) app.updateVideoVisibility();

      } else {

        app.landscapeBlocked = false;
        popup.style.display = 'none';
        if (app.observer) app.observer.enable();
        if (app.updateVideoVisibility) app.updateVideoVisibility();

      }
    };

    app.reapplyResponsive = apply;
    mql.addEventListener('change', apply);

    setTimeout(apply, 0);

  });
})();

(() => {
  const ASPECT = 16 / 9;

  const applyCover = (box, iframe) => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    let iw, ih;
    if (w / h > ASPECT) { iw = w; ih = w / ASPECT; }
    else                { ih = h; iw = h * ASPECT; }
    Object.assign(iframe.style, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: iw + 'px', height: ih + 'px', maxWidth: 'none'
    });
  };

  const setSoundIcons = (btn, muted, animate) => {
    const iSound = btn.querySelector('.icon-24-24-16:not(.is-mute)');
    const iMute = btn.querySelector('.icon-24-24-16.is-mute');
    const dur = animate ? 0.2 : 0;
    if (iSound) gsap.to(iSound, { autoAlpha: muted ? 0 : 1, duration: dur });
    if (iMute) gsap.to(iMute, { autoAlpha: muted ? 1 : 0, duration: dur });
  };

  const initVideo = (box) => {
    box.style.position = 'relative';
    box.style.overflow = 'hidden';

    let iframe = box.querySelector('iframe');
    if (!iframe) {

      return null;
    }

    if (iframe.parentElement && iframe.parentElement !== box) {
      const wrap = iframe.parentElement;
      box.appendChild(iframe);
      wrap.remove();
    }

    const player = new Vimeo.Player(iframe);

    player.ready().then(() => {
      applyCover(box, iframe);
      new ResizeObserver(() => applyCover(box, iframe)).observe(box);

    }).catch((e) => void 0);

    let soundOn = false;
    const sectionEl = box.closest('[data-kulbit-section]');
    const sectionIndex = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;

    const btn = (sectionEl || document).querySelector('[data-kulbit-sound]');
    if (btn) {
      setSoundIcons(btn, true, false);
      btn.addEventListener('click', () => {
        soundOn = !soundOn;
        player.setMuted(!soundOn);
        setSoundIcons(btn, !soundOn, true);

      });
    }

    return {
      player, sectionIndex,
      show: () => { player.play(); player.setMuted(!soundOn); },
      hide: () => { player.pause(); player.setMuted(true); }
    };
  };

  window.KulbitApp = window.KulbitApp || {};

  window.KulbitApp.showCurrentVideo = () => {
    const app = window.KulbitApp;
    if (app.videoFullscreen) return;
    if (app.landscapeBlocked) return;
    (app.videos || []).forEach((rec) => {
      if (rec.sectionIndex === app.currentSectionIndex) rec.show();
    });
  };

  window.KulbitApp.hideOtherVideos = () => {
    const app = window.KulbitApp;
    if (app.videoFullscreen) return;
    (app.videos || []).forEach((rec) => {
      if (app.landscapeBlocked || rec.sectionIndex !== app.currentSectionIndex) rec.hide();
    });
  };

  window.KulbitApp.updateVideoVisibility = () => {
    window.KulbitApp.hideOtherVideos();
    window.KulbitApp.showCurrentVideo();
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Vimeo === 'undefined') {

      return;
    }
    const boxes = document.querySelectorAll('[data-kulbit-video]');
    if (!boxes.length) {

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

(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const SELECTOR = '[data-kulbit-border]';

  const config = {
    duration: 0.3,
    ease: 'none',
    sampleN: 64,
    offset: 0
  };

  const getBlue = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--colors--blue').trim() || '#62b0ff';

  const setupElement = (el) => {
    const blue = getBlue();
    const state = { p: 0, center: 0, mode: 'hover', rect: null, svg: null, L: 0, w: 0, h: 0 };

    const draw = (center, frac) => {
      if (!state.rect) return;
      const len = frac * state.L;
      state.rect.style.strokeDasharray = `${len} ${state.L - len}`;
      state.rect.style.strokeDashoffset = `${len / 2 - center}`;
      state.rect.style.opacity = frac;
    };

    const drawFull = (frac) => {
      if (!state.rect) return;
      state.rect.style.strokeDasharray = `${state.L} 0`;
      state.rect.style.strokeDashoffset = '0';
      state.rect.style.opacity = frac;
    };

    const render = () => {
      if (state.mode === 'focus') drawFull(state.p);
      else draw(state.center, state.p);
    };

    const build = () => {
      const cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';

      const w = el.offsetWidth;
      const h = el.offsetHeight;

      const sw = parseFloat(cs.outlineWidth) || parseFloat(cs.borderTopWidth) || 2;
      const r = parseFloat(cs.borderTopLeftRadius) || 0;

      if (state.svg) state.svg.remove();

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('preserveAspectRatio', 'none');

      const off = config.offset;
      Object.assign(svg.style, {
        position: 'absolute',
        top: '0', left: '0', width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'visible', zIndex: '2'
      });

      const i = sw / 2;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', i - off);
      rect.setAttribute('y', i - off);
      rect.setAttribute('width', (w - sw) + 2 * off);
      rect.setAttribute('height', (h - sw) + 2 * off);
      rect.setAttribute('rx', Math.max(0, r - i + off));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', blue);
      rect.setAttribute('stroke-width', sw);
      svg.appendChild(rect);
      el.appendChild(svg);

      state.svg = svg;
      state.rect = rect;
      state.w = w;
      state.h = h;
      state.L = rect.getTotalLength();
      render();
    };

    const offsetFromMouse = (e) => {
      const b = el.getBoundingClientRect();
      const mx = (e.clientX - b.left) * (state.w / b.width);
      const my = (e.clientY - b.top) * (state.h / b.height);
      let best = 0, bestD = Infinity;
      for (let k = 0; k <= config.sampleN; k++) {
        const pt = state.rect.getPointAtLength((k / config.sampleN) * state.L);
        const d = (pt.x - mx) ** 2 + (pt.y - my) ** 2;
        if (d < bestD) { bestD = d; best = (k / config.sampleN) * state.L; }
      }
      return best;
    };

    const tweenP = (target) => {
      gsap.killTweensOf(state);
      gsap.to(state, {
        p: target,
        duration: config.duration,
        ease: config.ease,
        onUpdate: render
      });
    };

    let hovered = false, focused = false;

    el.addEventListener('mouseenter', (e) => {
      hovered = true;
      state.mode = 'hover';
      state.center = offsetFromMouse(e);
      tweenP(1);
    });
    el.addEventListener('mouseleave', () => {
      hovered = false;
      if (focused) { state.mode = 'focus'; tweenP(1); }
      else tweenP(0);
    });

    el.addEventListener('focusin', () => {
      focused = true;
      if (!hovered) { state.mode = 'focus'; tweenP(1); }
    });
    el.addEventListener('focusout', () => {
      focused = false;
      if (!hovered) tweenP(0);
    });

    build();
    return build;
  };

  const setupHeroColors = (el) => {
    let hov = false, foc = false;
    const apply = () => {
      const active = hov || foc;
      el.style.color = active ? 'var(--colors--white-10)' : '';
      el.querySelectorAll('svg').forEach((s) => { s.style.color = active ? 'var(--colors--blue)' : ''; });
    };
    el.addEventListener('mouseenter', () => { hov = true; apply(); });
    el.addEventListener('mouseleave', () => { hov = false; apply(); });
    el.addEventListener('focusin', () => { foc = true; apply(); });
    el.addEventListener('focusout', () => { foc = false; apply(); });
  };

  document.addEventListener('DOMContentLoaded', () => {

    const heroBtns = document.querySelectorAll('.button.is-hero');
    heroBtns.forEach((el) => setupHeroColors(el));
    if (heroBtns.length) void 0;

    if (typeof gsap === 'undefined') {

      return;
    }
    const els = document.querySelectorAll(SELECTOR);
    if (!els.length) {

      return;
    }

    const rebuilders = Array.from(els).map((el) => setupElement(el));

    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => rebuilders.forEach((fn) => fn()), 150);
    });

  });
})();

(() => {
  const ASPECT = 16 / 9;
  const ICON_DUR = 0.15;
  const POPUP_DUR = 0.2;
  const FADE_DUR = 0.3;
  const COMPACT_MAX = 991;

  const isCompact = () => window.innerWidth <= COMPACT_MAX;

  const registry = [];

  const applyCover = (box, iframe) => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    let iw, ih;
    if (w / h > ASPECT) { iw = w; ih = w / ASPECT; }
    else                { ih = h; iw = h * ASPECT; }
    Object.assign(iframe.style, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: iw + 'px', height: ih + 'px', maxWidth: 'none'
    });
  };

  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' + sec : '' + sec);
  };

  const initProjectVideo = (root) => {
    root.style.position = 'relative';
    root.style.overflow = 'hidden';

    const iframe = root.querySelector('iframe');
    if (!iframe) {

      return null;
    }

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
    let seekDrag = false, seekFrac = 0;
    let volDrag = false;
    let popupOpen = false;

    const setToggleIcon = (playing) => {
      if (iconPause) gsap.to(iconPause, { autoAlpha: playing ? 1 : 0, duration: ICON_DUR });
      if (iconPlay)  gsap.to(iconPlay,  { autoAlpha: playing ? 0 : 1, duration: ICON_DUR });
    };

    const renderProgress = (frac) => {
      if (seekFill) seekFill.style.width = (frac * 100) + '%';
      if (timeCurrent) timeCurrent.textContent = fmt(frac * duration);
    };
    const seekFracFromX = (clientX) => {
      const rect = seek.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };

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
        onComplete: () => { if (!popupOpen) popup.style.display = 'none'; } });
    };

    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const enterFs = () => {

      if (isCompact() && player.requestFullscreen) {
        player.requestFullscreen().catch((e) => void 0);
        return;
      }
      if (root.requestFullscreen) root.requestFullscreen();
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
      else void 0;
    };
    const exitFs = () => {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    };

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

    const resetToInitial = () => {
      player.pause();
      player.setCurrentTime(0);
      showInitial();
    };

    const startPlayback = () => {

      registry.forEach((other) => { if (other.player !== player) other.resetToInitial(); });
      if (poster)  gsap.to(poster,  { autoAlpha: 0, duration: FADE_DUR });
      if (bigPlay) gsap.to(bigPlay, { autoAlpha: 0, duration: FADE_DUR });
      if (controls) controls.style.display = 'flex';

      player.play();
    };

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

    }).catch((e) => void 0);

    if (bigPlay) bigPlay.addEventListener('click', startPlayback);
    if (toggle) toggle.addEventListener('click', () => {
      player.getPaused().then((paused) => { if (paused) player.play(); else player.pause(); });
    });

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

    if (volume) volume.addEventListener('click', (e) => {

      if (isCompact()) {
        player.getMuted().then((m) => { player.setMuted(!m); setVolumeIcon(!m ? 0 : 1); });
        return;
      }
      if (popup && popup.contains(e.target)) return;
      if (popupOpen) closePopup(); else openPopup();
    });
    document.addEventListener('click', (e) => {
      if (popupOpen && volume && !volume.contains(e.target)) closePopup();
    });

    if (track) {
      track.addEventListener('pointerdown', (e) => {
        volDrag = true; applyVolume(volFracFromY(e.clientY)); track.setPointerCapture(e.pointerId);
      });
      track.addEventListener('pointermove', (e) => {
        if (!volDrag) return; applyVolume(volFracFromY(e.clientY));
      });
      track.addEventListener('pointerup', () => { volDrag = false; });
    }

    if (fsBtn) fsBtn.addEventListener('click', () => { if (fsElement()) exitFs(); else enterFs(); });
    const onFsChange = () => {
      applyCover(root, iframe);

      const app = window.KulbitApp;
      if (app && app.observer) { if (fsElement()) app.observer.disable(); else app.observer.enable(); }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    player.on('play',  () => {
      setToggleIcon(true);

      registry.forEach((other) => { if (other.player !== player) other.resetToInitial(); });
    });
    player.on('pause', () => setToggleIcon(false));
    player.on('ended', () => setToggleIcon(false));

    player.on('fullscreenchange', (data) => {
      const app = window.KulbitApp || {};
      app.videoFullscreen = !!(data && data.fullscreen);
      if (app.reapplyResponsive) app.reapplyResponsive();
    });

    player.on('volumechange', (data) => {
      player.getMuted().then((m) => setVolumeIcon(m ? 0 : (data && data.volume != null ? data.volume : 1)));
    });
    player.on('timeupdate', (data) => {
      if (seekDrag) return;
      if (data.duration) duration = data.duration;
      renderProgress(data.percent || 0);
    });
    player.on('progress', (data) => {
      if (buffer) buffer.style.width = ((data.percent || 0) * 100) + '%';
    });

    const sectionEl = root.closest('[data-kulbit-section]');
    const sectionIndex = sectionEl ? parseInt(sectionEl.getAttribute('data-section-index'), 10) : 0;
    registry.push({ player, resetToInitial });
    return {
      player, sectionIndex,
      show: () => {},
      hide: () => player.pause()
    };
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Vimeo === 'undefined') {

      return;
    }
    const roots = document.querySelectorAll('[data-kulbit-project-video]');
    if (!roots.length) {

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

(() => {
  const SC = { chars: 'upperCase', speed: 1 };
  const DUR = 1.2;

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

  const makeReveal = (el, mode) => {
    if (el.dataset.scrOrig == null) el.dataset.scrOrig = el.innerHTML;
    else el.innerHTML = el.dataset.scrOrig;
    el.style.height = ''; el.style.overflow = '';
    const targets = buildSegDOM(el, parseSegments(el), true);
    el.style.height = el.offsetHeight + 'px';
    el.style.overflow = 'hidden';
    let shown = true, tl = null;
    const animateTo = (show) => {
      if (tl) tl.kill();
      tl = gsap.timeline();

      const totalChars = mode === 'typewriter'
        ? (targets.reduce((sum, [, t]) => sum + t.length, 0) || 1)
        : 0;
      targets.forEach(([s, t]) => {
        if (mode === 'typewriter') {
          const spanDur = (t.length / totalChars) * DUR;
          const o = { p: show ? 0 : 1 };
          tl.to(o, {
            p: show ? 1 : 0, duration: spanDur, ease: 'none',
            onUpdate: () => { s.textContent = t.slice(0, Math.ceil(o.p * t.length)); }
          });
        } else {
          tl.to(s, { duration: DUR, scrambleText: { text: show ? t : '', ...SC } }, 0);
        }
      });
      shown = show;
    };
    return {
      el, mode,
      in()  { if (!shown) animateTo(true); },
      out() { if (shown) animateTo(false); },
      setOut() { if (tl) tl.kill(); targets.forEach(([s]) => { s.textContent = ''; }); shown = false; }
    };
  };

  let io = null, resizeTimer = null;
  const build = () => {
    const app = window.KulbitApp = window.KulbitApp || {};
    app.scrambles = app.scrambles || new Map();
    if (io) io.disconnect();
    app.scrambles.clear();
    const scrambleEls   = [...document.querySelectorAll('[data-kulbit-scramble]')].map((el) => [el, 'scramble']);
    const typewriterEls = [...document.querySelectorAll('[data-kulbit-typewriter]')].map((el) => [el, 'typewriter']);
    const all = [...scrambleEls, ...typewriterEls];
    if (!all.length) {  return; }
    all.forEach(([el, mode]) => {
      const ctrl = makeReveal(el, mode);
      ctrl.setOut();
      app.scrambles.set(el, ctrl);
    });

    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const ctrl = app.scrambles.get(en.target);
        if (!ctrl) return;
        if (en.intersectionRatio >= 0.6) ctrl.in();
        else if (!en.isIntersecting) ctrl.out();
      });
    }, { threshold: [0, 0.6] });
    all.forEach(([el]) => io.observe(el));

  };

  document.addEventListener('DOMContentLoaded', build);
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 200); });
})();
