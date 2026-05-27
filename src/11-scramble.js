// ====================================================================
// 11-scramble.js — Скрамбл-поява тексту за атрибутом [data-kulbit-scramble]
//
//   Будь-який текст із цим атрибутом «пишеться» скрамблом, коли зʼявляється
//   у вьюпорті (наповзання секції), і стирається при виході (для повторної
//   появи). Сегментує текст зі збереженням спанів (кольори) — як is-our-clients.
//
//   Контролери зберігаються в app.scrambles (Map: el → { in, out, setOut }) —
//   секції з власною хореографією (is-our-services: h2 стирається на кроці)
//   можуть керувати вручну через app.scrambles.get(el).
//
//   ⚠️ Пропускає елементи всередині .is-our-clients — там власна scramble-логіка
//      в buildOurClients (рефактор на цей модуль — окремим кроком).
// ====================================================================

console.log('[Kulbit] 11-scramble.js завантажено');

// ## — Скрамбл-поява за атрибутом
(() => {
  const SC = { chars: 'upperCase', speed: 1 };

  // Розрізати вміст на сегменти [текст, клас] — щоб зберегти кольорові спани
  const parseSegments = (e) => {
    const segs = [];
    e.childNodes.forEach((n) => {
      if (n.nodeType === 3) segs.push([n.textContent, '']);
      else if (n.nodeType === 1) segs.push([n.textContent, n.getAttribute('class') || '']);
    });
    return segs;
  };
  // Відбудувати DOM зі спанів (із текстом або без), повернути [span, text] для скрамблу
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

  // Контролер одного елемента: in (порожньо→текст), out (текст→порожньо), setOut (миттєво порожньо)
  const makeScramble = (el) => {
    // Оригінальний HTML зберігаємо ОДИН раз; при перебудові (поворот/брейкпоінт) відновлюємо —
    //   бо scramble/setOut спорожнюють DOM, і повторний parse читав би порожнечу (як фікс is-our-clients).
    if (el.dataset.scrOrig == null) el.dataset.scrOrig = el.innerHTML;
    else el.innerHTML = el.dataset.scrOrig;
    el.style.height = ''; el.style.overflow = '';
    const targets = buildSegDOM(el, parseSegments(el), true);
    el.style.height = el.offsetHeight + 'px';   // фіксуємо висоту (стабільно при скрамблі)
    el.style.overflow = 'hidden';
    let shown = true, tl = null;
    const animateTo = (show) => {
      if (tl) tl.kill();
      tl = gsap.timeline();
      targets.forEach(([s, t]) => tl.to(s, { duration: 1.2, scrambleText: { text: show ? t : '', ...SC } }, 0));
      shown = show;
    };
    return {
      el,
      in()  { if (!shown) animateTo(true); },
      out() { if (shown) animateTo(false); },
      setOut() { if (tl) tl.kill(); targets.forEach(([s]) => { s.textContent = ''; }); shown = false; }
    };
  };

  // Збірка/перезбірка: усі [data-kulbit-scramble], IO керує появою/виходом. Re-runnable на resize —
  //   бо висота заголовка залежить від брейкпоінта (makeScramble відновлює оригінал і переміряє).
  let io = null, resizeTimer = null;
  const build = () => {
    const app = window.KulbitApp = window.KulbitApp || {};
    app.scrambles = app.scrambles || new Map();
    if (io) io.disconnect();
    app.scrambles.clear();
    const els = [...document.querySelectorAll('[data-kulbit-scramble]')];
    if (!els.length) { console.log('[Kulbit-Scramble] елементів [data-kulbit-scramble] немає'); return; }
    els.forEach((el) => {
      const ctrl = makeScramble(el);
      ctrl.setOut();                        // старт порожньо — зʼявляться скрамблом при вході у вьюпорт
      app.scrambles.set(el, ctrl);
    });
    // Поява у вьюпорті (наповзання секції) → IN; повний вихід → стираємо (готуємо до повторної появи)
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const ctrl = app.scrambles.get(en.target);
        if (!ctrl) return;
        if (en.intersectionRatio >= 0.6) ctrl.in();
        else if (!en.isIntersecting) ctrl.out();
      });
    }, { threshold: [0, 0.6] });
    els.forEach((el) => io.observe(el));
    console.log('[Kulbit-Scramble] активний на', els.length, 'елемент(ах)');
  };

  document.addEventListener('DOMContentLoaded', build);
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 200); });
})();
