define(["util/platform"], function(sys) {

  /*
  SyncFS stores Caret's settings files (as strings) by name. It used to chunk
  them to fit inside chrome.storage.sync's 4KB-per-item limit; now that they
  live in localStorage there's no need, but the module keeps the same
  get/set/remove interface for Settings and SyncFile.

  Settings are no longer synchronized between devices. To move them, open the
  settings files from the menu, copy the text, and paste it on the other end.
  */

  return {
    get: async function(key) {
      var data = await sys.storage.sync.get(key);
      return typeof data[key] == "string" ? data[key] : null;
    },
    set: async function(key, data) {
      var item = {};
      item[key] = data;
      await sys.storage.sync.set(item);
    },
    remove: async function(key) {
      await sys.storage.sync.remove(key);
    }
  };

});
