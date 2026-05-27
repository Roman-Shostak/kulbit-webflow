// ====================================================================
// 04-navigation.js — Кнопки-переходи (data-target-section / data-target-step)
//                    Делегування: працює для будь-яких кнопок, доданих будь-коли
// ====================================================================

console.log('[Kulbit] 04-navigation.js завантажено');

// ## — Обробник кнопок-переходів
(() => {
  window.KulbitApp = window.KulbitApp || {};
  const app = window.KulbitApp;

  // 01 — Резолв цілі: число → прямий індекс; рядок → пошук секції з data-section-name.
  //      Іменовані якорі стійкі до реордеру секцій — рекомендовано для клієнтських кнопок.
  const resolveIndex = (target) => {
    if (target === null) return -1;
    if (/^\d+$/.test(target)) return parseInt(target, 10);
    const found = app.sections.find((s) => s.el.getAttribute('data-section-name') === target);
    return found ? found.index : -1;
  };

  // 02 — Делегований клік по всьому документу (ловить і майбутні кнопки з Webflow)
  const onClick = (e) => {
    const trigger = e.target.closest('[data-target-section]');
    if (!trigger) return;
    e.preventDefault();

    const index = resolveIndex(trigger.getAttribute('data-target-section'));
    if (index < 0) {
      console.warn('[Kulbit-Nav] ціль не знайдено:', trigger.getAttribute('data-target-section'));
      return;
    }

    // Якщо вказано data-target-step — перехід на секцію + конкретний крок
    const stepAttr = trigger.getAttribute('data-target-step');
    if (stepAttr !== null) {
      console.log('[Kulbit-Nav] клік → секція', index, 'крок', stepAttr);
      app.goToSectionStep(index, parseInt(stepAttr, 10));
    } else {
      // dir обовʼязковий: без нього goToSection іде в гілку «вгору» й сповзає hero (видно фон).
      //   Завжди ПЛАВНО: goToSection виставляє проміжні секції в стек і плавно наводить ціль (стрибок).
      const dir = index > app.currentSectionIndex ? 1 : -1;
      console.log('[Kulbit-Nav] клік → секція', index);
      app.goToSection(index, false, dir);
    }
  };

  document.addEventListener('click', onClick);
  console.log('[Kulbit-Nav] ✅ Обробник кнопок-переходів активний (делегування)');
})();
