// ====================================================================
// 02-app-core.js — Ядро застосунку: стан, config, фіксація вьюпорта,
//                   Observer + логіка жесту (анти-інерція)
// ====================================================================

console.log('[Kulbit] 02-app-core.js завантажено');

// ## — Створення глобального обʼєкта KulbitApp + ініціалізація
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // 01 — Стан (єдина точка істини про сайт)
  app.sections = app.sections || []; // масив зареєстрованих секцій (заповнює 03-sections.js)
  app.currentSectionIndex = 0;       // індекс поточної секції
  app.currentStep = 0;               // поточний крок у покроковій секції (Крок 5)
  app.isAnimating = false;           // блокування під час переходів
  app.observer = null;               // інстанс Observer
  app.wrapper = null;                // #smooth-wrapper — фіксований вьюпорт
  app.content = null;                // #smooth-content — рухомий трек із секціями

  // 02 — Конфіг (усі числа тут, без magic numbers по коду)
  app.config = {
    scrollDuration: 0.7,       // тривалість переходу між секціями
    stepDuration: 0.6,         // тривалість кроку покрокової анімації (Крок 5)
    autoPlayStepDuration: 0.3, // швидке догравання при кліку на кнопку (Крок 4)
    ease: 'power2.inOut',      // easing переходів
    accelRatio: 1.4,           // у скільки разів має зрости швидкість, щоб вважати НОВИМ фліком
    minVelocity: 60,           // нижче цієї швидкості — «дотихання» інерції, ігноруємо
    landscapeMaxHeight: 500    // ≤ цієї висоти в landscape = телефон → попап «поверни» (ADR-004)
  };

  // 03 — Фіксація вьюпорта: вільний скрол стає фізично неможливим
  app.lockViewport = () => {
    app.wrapper = document.querySelector('#smooth-wrapper');
    app.content = document.querySelector('#smooth-content');
    if (!app.wrapper || !app.content) {
      console.error('[Kulbit-Core] ❌ Немає #smooth-wrapper / #smooth-content — перевір розмітку');
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
    console.log('[Kulbit-Core] вьюпорт зафіксовано (вільний скрол вимкнено)');
    return true;
  };

  // 04 — Логіка жесту: відрізняємо НОВИЙ флік від хвоста інерції за швидкістю.
  //      Хвіст інерції сповільнюється → ігноруємо; новий флік дає сплеск швидкості → приймаємо.
  let flinging = false; // чи триває інерція попереднього жесту
  let prevVel = 0;      // швидкість попередньої події (для детекції прискорення)

  const handleGesture = (dir, self) => {
    const vel = Math.abs(self.velocityY);
    const accelerating = vel > prevVel * app.config.accelRatio && vel > app.config.minVelocity;
    prevVel = vel;

    if (app.isAnimating) return;           // йде перехід/крок — чекаємо завершення
    if (flinging && !accelerating) return; // це хвіст інерції — ігноруємо

    flinging = true;
    app.advance(dir); // advance вирішує: крок чи секція (визначено у 03-sections.js)
  };

  // 05 — Створення Observer (один жест = один перехід)
  app.setupObserver = () => {
    if (app.observer) app.observer.kill();
    // Напрямок визначаємо за ТИПОМ ПОДІЇ, а НЕ за девайсом (надійніше: деякі десктопи хибно
    // звітують pointer:coarse → тач-інверсія ламала колесо). Колесо — натурально (вниз = далі);
    // тач-свайп — інверсно (свайп угору = далі, як нативний скрол). 'pointer' НЕ слухаємо —
    // щоб затиснута ЛКМ + рух мишею не сприймались як скрол (на будь-якому девайсі).
    const gestureDir = (down, self) => {
      const isWheel = self.event && self.event.type === 'wheel';
      return isWheel ? (down ? 1 : -1) : (down ? -1 : 1);
    };
    app.observer = Observer.create({
      target: window,
      type: 'wheel,touch',
      tolerance: 10,
      preventDefault: true, // блокуємо нативний скрол — рухаємось ТІЛЬКИ по секціях
      onDown: (self) => handleGesture(gestureDir(true, self), self),
      onUp: (self) => handleGesture(gestureDir(false, self), self),
      onStop: () => { flinging = false; prevVel = 0; } // приймаємо новий ввід лише коли все стихло
    });
    console.log('[Kulbit-Core] Observer створено (snap активний), type: wheel,touch; напрямок за подією');
  };

  // 06 — Ресайз. У стекінгу (ADR-010) висота 100vh і yPercent самі підлаштовуються під
  //      новий розмір; для певності перевиставляємо дискретні позиції, якщо не йде анімація.
  let resizeTimer = null;
  app.handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!app.isAnimating && app.applyStackingPositions) {
        app.applyStackingPositions();
        console.log('[Kulbit-Core] ресайз — позиції стекінгу оновлено');
      }
    }, 150);
  };

  // 07 — Ініціалізація після готовності DOM
  app.init = () => {
    // Захист: якщо десь лишився живий ScrollSmoother — прибираємо (він тягне вільний скрол)
    if (typeof ScrollSmoother !== 'undefined' && ScrollSmoother.get()) {
      ScrollSmoother.get().kill();
      console.log('[Kulbit-Core] знайдено старий ScrollSmoother — прибрано');
    }

    if (!app.lockViewport()) return;
    app.registerSections();   // визначено у 03-sections.js
    app.setupStacking();      // стекінг-лейаут: секції абсолютом одна над одною (ADR-010)
    app.registerSteps();      // reveal-кроки [data-kulbit-step]
    app.registerAnimations(); // кастомні таймлайни секцій (ADR-009; тільки desktop)
    app.setupObserver();
    window.addEventListener('resize', app.handleResize);
    console.log('[Kulbit-Core] ✅ KulbitApp ініціалізовано');
  };

  document.addEventListener('DOMContentLoaded', () => app.init());
})();
