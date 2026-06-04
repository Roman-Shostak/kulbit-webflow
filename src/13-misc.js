// ====================================================================
// 13-misc.js — Дрібні утиліти сторінки (перенесені з інлайн-коду Webflow).
// ====================================================================

console.log('[Kulbit] 13-misc.js завантажено');

// ## — Автоматичний рік у копірайті (елемент #copyright-year)
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('copyright-year');
    if (!yearEl) { console.log('[Kulbit-Misc] #copyright-year не знайдено — пропускаємо'); return; }
    yearEl.textContent = new Date().getFullYear();
    console.log('[Kulbit-Misc] рік копірайту →', yearEl.textContent);
  });
})();
