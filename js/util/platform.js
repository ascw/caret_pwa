define([
    "storage/entry",
    "storage/handles"
  ], function(Entry, handles) {

  /*

  Thin wrappers around the browser features that Caret used to get from the
  chrome.* Apps APIs. Everything here is Promise-based except retainEntry(),
  which is synchronous (the handle is saved in the background).

  - storage.local / storage.sync: key/value storage backed by localStorage.
    "sync" is kept as a separate area so existing code reads naturally, but
    nothing is synchronized between devices anymore.
  - fileSystem: file/folder pickers and handle retention, via the File System
    Access API.
  - runtime.getPlatformInfo: a best-effort OS check.

  */

  var PREFIXES = {
    local: "caret.local.",
    sync: "caret.sync."
  };

  var makeStorage = function(area) {
    var prefix = PREFIXES[area];

    var allNames = function() {
      var names = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.indexOf(prefix) == 0) names.push(key.slice(prefix.length));
      }
      return names;
    };

    var parse = function(raw) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        return undefined;
      }
    };

    return {
      //keys can be a string, an array of strings, or omitted for everything
      get: async function(keys) {
        var names;
        if (keys === undefined || keys === null) {
          names = allNames();
        } else if (typeof keys == "string") {
          names = [keys];
        } else {
          names = keys;
        }
        var out = {};
        names.forEach(function(name) {
          var raw = localStorage.getItem(prefix + name);
          if (raw === null) return;
          var value = parse(raw);
          if (typeof value !== "undefined") out[name] = value;
        });
        return out;
      },
      set: async function(items) {
        for (var key in items) {
          localStorage.setItem(prefix + key, JSON.stringify(items[key]));
        }
      },
      remove: async function(keys) {
        [].concat(keys).forEach(key => localStorage.removeItem(prefix + key));
      },
      clear: async function() {
        allNames().forEach(name => localStorage.removeItem(prefix + name));
      }
    };
  };

  var pickerError = function() {
    return new Error("This browser can't open local files for editing. Caret needs a recent version of Chrome, Edge, or Chrome OS.");
  };

  var sys = {

    fileSystem: {

      supported: !!(window.showOpenFilePicker && window.showSaveFilePicker && window.showDirectoryPicker),

      //options.type is one of openFile, openWritableFile, saveFile, openDirectory
      //Resolves null if the user cancels.
      chooseEntry: async function(options) {
        options = options || {};
        if (!sys.fileSystem.supported) throw pickerError();
        try {
          if (options.type == "openDirectory") {
            var dir = await showDirectoryPicker({ id: "caret-folders", mode: "readwrite" });
            return Entry.wrap(dir);
          }
          if (options.type == "saveFile") {
            var saved = await showSaveFilePicker({
              id: "caret-files",
              suggestedName: options.suggestedName
            });
            return Entry.wrap(saved);
          }
          var picked = await showOpenFilePicker({
            id: "caret-files",
            multiple: !!options.acceptsMultiple
          });
          var entries = picked.map(handle => Entry.wrap(handle));
          return options.acceptsMultiple ? entries : entries[0];
        } catch (err) {
          //cancelling the picker rejects with AbortError
          if (err.name == "AbortError") return null;
          throw err;
        }
      },

      //real disk paths aren't available to web apps
      getDisplayPath: function(entry) {
        return Promise.resolve(entry.fullPath);
      },

      retainEntry: function(entry) {
        return Entry.retain(entry);
      },

      restoreEntry: function(id) {
        return Entry.restore(id);
      }
    },

    runtime: {
      getPlatformInfo: async function() {
        var ua = navigator.userAgent || "";
        var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
        var os = "linux";
        if (/CrOS/.test(ua) || /chrome os/i.test(platform)) {
          os = "cros";
        } else if (/mac/i.test(platform)) {
          os = "mac";
        } else if (/win/i.test(platform)) {
          os = "win";
        }
        return { os: os };
      }
    },

    //major version of Chromium, or 0 if we can't tell
    browserVersion: (function() {
      var match = (navigator.userAgent || "").match(/Chrome\/(\d+)/);
      return match ? match[1] * 1 : 0;
    })(),

    storage: {
      local: makeStorage("local"),
      sync: makeStorage("sync")
    },

    //wipe everything Caret has stored locally, then start over
    reset: async function() {
      await sys.storage.local.clear();
      await sys.storage.sync.clear();
      try {
        await handles.clear();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return sys;

});
