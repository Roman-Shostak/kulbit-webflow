// ====================================================================
// 11-scramble.js — Поява тексту за атрибутом (scramble АБО typewriter)
//
//   Два атрибути, спільна механіка:
//   • [data-kulbit-scramble]   — текст «пишеться» скрамблом (через GSAP ScrambleTextPlugin);
//   • [data-kulbit-typewriter] — текст ДРУКУЄТЬСЯ по літерах (typewriter, без плагіна — tween числа).
//
//   Обидва: зʼявляються коли елемент потрапляє у вьюпорт (наповзання секції), стираються на виході
//   (для повторної появи). Сегментують вміст зі збереженням спанів (кольори).
//
//   Контролери — у app.scrambles (Map: el → { in, out, setOut }) — секції з власною хореографією
//   (is-our-services) керують вручну через app.scrambles.get(el). Re-runnable на resize.
// ====================================================================

console.log('[Kulbit] 11-scramble.js завантажено');

// ## — Поява тексту за атрибутом (scramble / typewriter)
(() => {
  const SC = { chars: 'upperCase', speed: 1 };
  const DUR = 1.2; // тривалість появи/стирання (секунди)

  // Розрізати вміст на сегменти [текст, клас] — щоб зберегти кольорові спани
  const parseSegments = (e) => {
    const segs = [];
    e.childNodes.forEach((n) => {
      if (n.nodeType === 3) segs.push([n.textContent, '']);
      else if (n.nodeType === 1) segs.push([n.textContent, n.getAttribute('class') || '']);
    });
    return segs;
  };
  // Відбудувати DOM зі спанів (із текстом або без), повернути [span, text] для tween-ів
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

  // Контролер одного елемента: in (порожньо→текст), out (текст→порожньо), setOut (миттєво порожньо).
  //   mode: 'scramble' (ScrambleTextPlugin) або 'typewriter' (tween числа + slice — без плагіна).
  const makeReveal = (el, mode) => {
    if (el.dataset.scrOrig == null) el.dataset.scrOrig = el.innerHTML;
    else el.innerHTML = el.dataset.scrOrig;
    el.style.height = ''; el.style.overflow = '';
    const targets = buildSegDOM(el, parseSegments(el), true);
    el.style.height = el.offsetHeight + 'px';   // фіксуємо висоту (стабільно при появі/стиранні)
    el.style.overflow = 'hidden';
    let shown = true, tl = null;
    const animateTo = (show) => {
      if (tl) tl.kill();
      tl = gsap.timeline();
      // typewriter: spans пишуться ПОСЛІДОВНО (один за одним); тривалість span — пропорційна
      //   його довжині (так усі літери йдуть з однаковою швидкістю, сумарно ≈ DUR).
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
          }); // без position → у кінець попереднього (послідовно)
        } else {
          tl.to(s, { duration: DUR, scrambleText: { text: show ? t : '', ...SC } }, 0); // scramble — паралельно
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

  // Збірка/перезбірка: збираємо обидва атрибути, IO керує появою/виходом. Re-runnable на resize
  //   (висота елемента залежить від брейкпоінта; makeReveal відновлює оригінал і переміряє).
  let io = null, resizeTimer = null;
  const build = () => {
    const app = window.KulbitApp = window.KulbitApp || {};
    app.scrambles = app.scrambles || new Map();
    if (io) io.disconnect();
    app.scrambles.clear();
    const scrambleEls   = [...document.querySelectorAll('[data-kulbit-scramble]')].map((el) => [el, 'scramble']);
    const typewriterEls = [...document.querySelectorAll('[data-kulbit-typewriter]')].map((el) => [el, 'typewriter']);
    const all = [...scrambleEls, ...typewriterEls];
    if (!all.length) { console.log('[Kulbit-Reveal] елементів [data-kulbit-scramble]/[data-kulbit-typewriter] немає'); return; }
    all.forEach(([el, mode]) => {
      const ctrl = makeReveal(el, mode);
      ctrl.setOut();                        // старт порожньо — зʼявляться при вході у вьюпорт
      app.scrambles.set(el, ctrl);
    });
    // Поява у вьюпорті → IN; повний вихід → стираємо (готуємо до повторної появи)
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const ctrl = app.scrambles.get(en.target);
        if (!ctrl) return;
        if (en.intersectionRatio >= 0.6) ctrl.in();
        else if (!en.isIntersecting) ctrl.out();
      });
    }, { threshold: [0, 0.6] });
    all.forEach(([el]) => io.observe(el));
    console.log('[Kulbit-Reveal] активний:', scrambleEls.length, 'scramble +', typewriterEls.length, 'typewriter');
  };

  document.addEventListener('DOMContentLoaded', build);
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 200); });
})();
