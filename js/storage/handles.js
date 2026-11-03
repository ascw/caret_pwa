define(function() {

  /*

  A tiny IndexedDB key/value store for FileSystemHandles. Handles can be
  structured-cloned into IndexedDB, which is the web platform's replacement
  for chrome.fileSystem.retainEntry(): we store the handle under a random ID,
  and later hand that ID back to restore it.

  */

  var DB_NAME = "caret";
  var STORE = "handles";
  var dbPromise = null;

  var open = function() {
    if (!dbPromise) {
      dbPromise = new Promise(function(ok, fail) {
        var request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = function() {
          request.result.createObjectStore(STORE);
        };
        request.onsuccess = function() { ok(request.result); };
        request.onerror = function() { fail(request.error); };
      });
    }
    return dbPromise;
  };

  var run = async function(mode, fn) {
    var db = await open();
    return new Promise(function(ok, fail) {
      var tx = db.transaction(STORE, mode);
      var request = fn(tx.objectStore(STORE));
      tx.oncomplete = function() { ok(request && request.result); };
      tx.onerror = tx.onabort = function() { fail(tx.error); };
    });
  };

  return {
    put: function(id, handle) {
      return run("readwrite", store => store.put(handle, id));
    },
    get: function(id) {
      return run("readonly", store => store.get(id));
    },
    remove: function(id) {
      return run("readwrite", store => store.delete(id));
    },
    clear: function() {
      return run("readwrite", store => store.clear());
    }
  };

});
