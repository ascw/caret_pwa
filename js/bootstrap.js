/*
Caret's entry point. RequireJS can't start until the translation strings are
available (modules call i18n.get() while they're being defined), so this plain
script loads them first, then loads RequireJS, which loads main.js.

Strings live in _locales/<language>/messages.json, the same files the Chrome
App used. The user's language is merged over English, so anything untranslated
falls back to English.
*/
(function() {

  //bump this when releasing; it's what the About dialog shows
  window.CARET_VERSION = "2.0.0";

  //languages that ship with Caret, and aliases for bare language codes
  var available = ["de", "en", "es", "fr", "hr", "it", "pt_BR", "ru", "sv", "vi", "zh_CN"];
  var aliases = { pt: "pt_BR", zh: "zh_CN" };

  var pickLocale = function() {
    var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    for (var i = 0; i < languages.length; i++) {
      var full = languages[i].replace("-", "_");
      var base = full.split("_")[0];
      if (available.indexOf(full) > -1) return full;
      if (available.indexOf(base) > -1) return base;
      if (aliases[base]) return aliases[base];
    }
    return "en";
  };

  var load = function(locale) {
    return fetch("_locales/" + locale + "/messages.json").then(function(response) {
      if (!response.ok) throw new Error("No messages for " + locale);
      return response.json();
    });
  };

  var start = function() {
    var script = document.createElement("script");
    script.setAttribute("data-main", "./js/main.js");
    script.src = "require.js";
    document.body.appendChild(script);
  };

  var locale = pickLocale();
  var english = load("en").catch(function() { return {}; });
  var preferred = locale == "en" ? english : load(locale).catch(function() { return {}; });

  Promise.all([english, preferred]).then(function(results) {
    window.caretMessages = Object.assign({}, results[0], results[1]);
    document.documentElement.lang = locale.replace("_", "-");
  }).catch(function(err) {
    console.error(err);
    window.caretMessages = {};
  }).then(start);

})();
