// PayLoop — Système de traduction FR/EN.
// Fonctionne page par page : chaque page définit ses propres textes dans window.PAYLOOP_I18N
// (déjà rempli avant que ce script se charge), et ce fichier se charge de les appliquer et de
// gérer le bouton FR/EN. La langue choisie est mémorisée (localStorage) et reste la même quand
// le client change de page.

(function () {
  var STORAGE_KEY = 'payloop_lang';

  function getStoredLang() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === 'fr' || v === 'en') return v;
    } catch (e) {}
    return 'fr';
  }

  function storeLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function applyTranslations(lang) {
    var dict = (window.PAYLOOP_I18N && window.PAYLOOP_I18N[lang]) || {};

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) el.setAttribute('placeholder', dict[key]);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (dict[key] !== undefined) el.setAttribute('title', dict[key]);
    });
    document.querySelectorAll('[data-i18n-content]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-content');
      if (dict[key] !== undefined) el.setAttribute('content', dict[key]);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-alt');
      if (dict[key] !== undefined) el.setAttribute('alt', dict[key]);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      if (dict[key] !== undefined) el.setAttribute('aria-label', dict[key]);
    });

    document.documentElement.setAttribute('lang', lang);

    // Certaines pages ont plusieurs paires de boutons FR/EN (ex : menu desktop + menu mobile) —
    // leurs id commencent tous par "lang-btn-fr"/"lang-btn-en", donc on les traite toutes.
    document.querySelectorAll('[id^="lang-btn-fr"]').forEach(function (btn) {
      btn.classList.toggle('lang-active', lang === 'fr');
    });
    document.querySelectorAll('[id^="lang-btn-en"]').forEach(function (btn) {
      btn.classList.toggle('lang-active', lang === 'en');
    });
  }

  window.setLang = function (lang) {
    storeLang(lang);
    applyTranslations(lang);
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyTranslations(getStoredLang());
  });
})();
