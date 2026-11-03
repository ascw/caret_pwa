define([
    "ui/dialog",
    "util/i18n"
  ], function(dialog, i18n) {

  /*

  Browsers forget file and folder permissions between sessions, and can only
  ask for them in response to a click or keypress. So when Caret restores
  tabs and projects on startup, it needs the user to click through once.

  ensure() takes a list of Entry objects and a message key. Entries that are
  already accessible are returned immediately; if any need to be asked for, it
  shows a single dialog first, then requests permission as part of the click.
  It resolves to the list of entries that can be used. Requests are queued so
  that two startup tasks never show overlapping dialogs.

  */

  var queue = Promise.resolve();

  var run = async function(entries, messageKey) {
    var granted = [];
    var needed = [];
    for (var entry of entries) {
      var state;
      try {
        state = await entry.permission(false);
      } catch (err) {
        state = "denied";
      }
      if (state == "granted") {
        granted.push(entry);
      } else if (state == "prompt") {
        needed.push(entry);
      }
    }
    if (!needed.length) return granted;

    var proceed = await dialog(i18n.get(messageKey, needed.length), [
      { label: i18n.get("permissionGrant"), value: true, shortcut: "y" },
      { label: i18n.get("permissionSkip"), value: false, shortcut: "n" }
    ]);
    if (!proceed) return granted;

    for (var entry of needed) {
      try {
        if (await entry.permission(true) == "granted") granted.push(entry);
      } catch (err) {
        console.warn("Permission request failed", err);
      }
    }
    return granted;
  };

  return {
    ensure: function(entries, messageKey) {
      var result = queue.then(() => run(entries, messageKey));
      queue = result.catch(function() {});
      return result;
    }
  };

});
