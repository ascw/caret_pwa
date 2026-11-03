define(function() {

  /*

  Translation lookups. The strings come from _locales/<language>/messages.json
  (the same files the Chrome App used), which js/bootstrap.js loads, merged
  over English, before anything else runs. They're published on
  window.caretMessages.

  */

  var messages = window.caretMessages || {};
  var translationCache = {};

  //equivalent of chrome.i18n.getMessage: $1..$9 are substitutions, $$ is a literal $
  var getMessage = function(key, subs) {
    var item = messages[key];
    if (!item || typeof item.message !== "string") return "";
    subs = [].concat(subs === undefined ? [] : subs);
    return item.message.replace(/\$(\d|\$)/g, function(match, token) {
      if (token == "$") return "$";
      var sub = subs[token - 1];
      return typeof sub == "undefined" ? "" : sub;
    });
  };

  return {
    //process a chunk of template HTML for i18n strings
    process: function(html) {
      return html.replace(/__MSG_(\w+)__/g, (match, tag) => getMessage(tag));
    },
    //process the page for inline strings, marked with .i18n
    page: function() {
      document.querySelectorAll(".i18n").forEach(function(element) {
        var original = element.innerHTML;
        var translated = getMessage(original);
        if (translated) element.innerHTML = translated;
        var title = element.getAttribute("title") || "";
        var translatedTitle = getMessage(title);
        if (translatedTitle) element.setAttribute("title", translatedTitle);
      });
    },
    //get a message, or return the untranslated text
    //caches results for speed
    get: function(message) {
      //rest params trigger uncached behavior for substitution
      if (!translationCache[message] || arguments.length > 1) {
        var subs = [];
        for (var i = 1; i < arguments.length; i++) subs.push(arguments[i]);
        var translated = getMessage(message, subs) || message;
        translationCache[message] = translated;
        return translated;
      }
      return translationCache[message];
    }
  }

});
