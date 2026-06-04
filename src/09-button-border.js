// ====================================================================
// 09-button-border.js — Ховер-ефект: промальовка кольорового бордера
//                       від точки курсора (матова лінія + opacity).
//                       Вішається на елементи з атрибутом [data-kulbit-border].
// ====================================================================

console.log('[Kulbit] 09-button-border.js завантажено');

// ## — Промальовка бордера від точки ховера
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const SELECTOR = '[data-kulbit-border]';

  // Конфіг ефекту (усі magic numbers — тут)
  const config = {
    duration: 0.3,  // тривалість промальовки / згортання
    ease: 'none',   // лінійний easing
    sampleN: 64,    // точність пошуку точки входу на периметрі
    offset: 0       // зсув штриха назовні від центру бордера (px); 0 = рівно по бордеру
  };

  // Колір зі змінної проєкту (з фолбеком)
  const getBlue = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--colors--blue').trim() || '#62b0ff';

  // ## — Налаштування одного елемента. Повертає функцію rebuild (для resize).
  const setupElement = (el) => {
    const blue = getBlue();
    const state = { p: 0, center: 0, mode: 'hover', rect: null, svg: null, L: 0, w: 0, h: 0 };

    // Ховер: видимий сегмент довжиною frac*L, центрований на offset center (з обгортанням контуру)
    const draw = (center, frac) => {
      if (!state.rect) return;
      const len = frac * state.L;
      state.rect.style.strokeDasharray = `${len} ${state.L - len}`;
      state.rect.style.strokeDashoffset = `${len / 2 - center}`;
      state.rect.style.opacity = frac; // проявлення через opacity
    };

    // Фокус: повне коло (без розриву), керуємо лише прозорістю (opacity 0 -> 1)
    const drawFull = (frac) => {
      if (!state.rect) return;
      state.rect.style.strokeDasharray = `${state.L} 0`;
      state.rect.style.strokeDashoffset = '0';
      state.rect.style.opacity = frac;
    };

    // Рендер за поточним режимом (ховер — від курсора; фокус — повне коло)
    const render = () => {
      if (state.mode === 'focus') drawFull(state.p);
      else draw(state.center, state.p);
    };

    // Перебудова SVG-оверлея під поточні розміри (init + resize)
    const build = () => {
      const cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      // offsetWidth/offsetHeight — ЛЕЙАУТ-розмір box (для viewBox + координат rect), імунний до transform.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      // Товщина лінії = outline-width (кнопка тепер з outline, а не border); фолбек на border / 2.
      const sw = parseFloat(cs.outlineWidth) || parseFloat(cs.borderTopWidth) || 2;
      const r = parseFloat(cs.borderTopLeftRadius) || 0; // радіус кутів

      // Елемент без лейауту (offsetWidth/Height = 0: display:none / прихований на цьому брейкпоінті,
      //   напр. mobile-only/mobile-hide кнопки футера) — НЕ будуємо rect: інакше width/height = -sw
      //   (від'ємне → SVG-помилка). Перебудуємо на resize, коли елемент стане видимим.
      if (w <= 0 || h <= 0) {
        if (state.svg) { state.svg.remove(); state.svg = null; state.rect = null; }
        return;
      }

      if (state.svg) state.svg.remove();

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      // Кнопка БЕЗ бордера (outline + outline-offset:-Npx) → її box = видимий край. Тому SVG заповнює
      // box через width/height:100% — percentage рахується від containing block у ЛЕЙАУТ-просторі
      // (дробово, точно, transform-safe; SVG масштабується разом із кнопкою) — БЕЗ вимірів px.
      // preserveAspectRatio:none → viewBox розтягується рівно під фактичний box, rect трасує периметр.
      const off = config.offset;
      Object.assign(svg.style, {
        position: 'absolute',
        top: '0', left: '0', width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'visible', zIndex: '2'
      });

      const i = sw / 2;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', i - off);                    // off>0 → штрих назовні від центру бордера
      rect.setAttribute('y', i - off);
      rect.setAttribute('width', Math.max(0, (w - sw) + 2 * off));   // захист від від'ємного (тонкі/межові box)
      rect.setAttribute('height', Math.max(0, (h - sw) + 2 * off));
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
      render(); // відновлюємо поточний стан (за режимом) після перебудови
    };

    // Найближча до курсора точка периметра (offset уздовж контуру)
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

    // Анімація прогресу p -> target (рендер за поточним режимом state.mode)
    const tweenP = (target) => {
      gsap.killTweensOf(state);
      gsap.to(state, {
        p: target,
        duration: config.duration,
        ease: config.ease,
        onUpdate: render
      });
    };

    // Лінія активна, поки є ховер АБО фокус. При p=1 обидва режими дають однакове повне
    // коло, тож перемикання hover<->focus у крайньому стані безшовне.
    let hovered = false, focused = false;

    el.addEventListener('mouseenter', (e) => {
      if (!state.rect) build();   // став видимим без resize — добудуємо оверлей на першому ховері
      if (!state.rect) return;    // усе ще без лейауту — пропускаємо
      hovered = true;
      state.mode = 'hover';
      state.center = offsetFromMouse(e); // ховер — промальовка від точки курсора
      tweenP(1);
    });
    el.addEventListener('mouseleave', () => {
      hovered = false;
      if (focused) { state.mode = 'focus'; tweenP(1); } // лишилась у фокусі — тримаємо повне коло
      else tweenP(0);
    });

    // Фокус (клавіатура/клік): повне коло плавно проявляється opacity 0 -> 1
    el.addEventListener('focusin', () => {
      focused = true;
      if (!hovered) { state.mode = 'focus'; tweenP(1); }
    });
    el.addEventListener('focusout', () => {
      focused = false;
      if (!hovered) tweenP(0); // згортання (поточний режим)
    });

    build();
    return build;
  };

  // ## — Кольори hero-кнопки на ховер/фокус (текст -> --colors--white-10; currentColor у SVG -> --colors--blue).
  //      Прив'язано до КЛАСУ .button.is-hero (а не до лінії/data-kulbit-border — у hero його може й не бути).
  //      Незалежний обробник; не потребує gsap. Якщо на кнопці є й лінія — обидва реагують на ті самі події.
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

  // ## — Ініціалізація після готовності DOM
  document.addEventListener('DOMContentLoaded', () => {
    // Кольори hero-кнопки — окремо й незалежно від лінії/gsap
    const heroBtns = document.querySelectorAll('.button.is-hero');
    heroBtns.forEach((el) => setupHeroColors(el));
    if (heroBtns.length) console.log('[Kulbit-Border] hero-кольори активні на', heroBtns.length, 'кнопці(ах)');

    if (typeof gsap === 'undefined') {
      console.error('[Kulbit-Border] ❌ GSAP не завантажений');
      return;
    }
    const els = document.querySelectorAll(SELECTOR);
    if (!els.length) {
      console.log('[Kulbit-Border] елементів [data-kulbit-border] не знайдено');
      return;
    }

    const rebuilders = Array.from(els).map((el) => setupElement(el));

    // Перебудова під нові розміри при ресайзі (debounce)
    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => rebuilders.forEach((fn) => fn()), 150);
    });

    console.log('[Kulbit-Border] ✅ ефект активний на', els.length, 'елемент(ах)');
  });
})();
