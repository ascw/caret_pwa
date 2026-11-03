define([
    "storage/handles"
  ], function(handles) {

  /*

  Entry wraps a File System Access handle (FileSystemFileHandle or
  FileSystemDirectoryHandle) and presents the handful of properties the rest
  of Caret used to get from Chrome Apps' FileEntry/DirectoryEntry objects:

  - name, isFile, isDirectory
  - fullPath: a display path. The web platform does not expose real disk
    paths, so this is "/name" for a file or folder the user picked directly,
    and "/folder/sub/name" for things found by walking a picked folder.

  Anything that needs to survive a reload is "retained" by saving the handle
  in IndexedDB under a random ID (see storage/handles).

  */

  var uuid = function() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  };

  var Entry = function(handle, fullPath) {
    this.handle = handle;
    this.name = handle.name;
    this.isFile = handle.kind == "file";
    this.isDirectory = handle.kind == "directory";
    this.fullPath = fullPath || "/" + handle.name;
    this.retainId = null;
  };

  Entry.prototype = {

    getFile: function() {
      return this.handle.getFile();
    },

    read: async function() {
      var file = await this.handle.getFile();
      return file.text();
    },

    //replaces the whole file (createWritable truncates by default)
    write: async function(data) {
      var writer = await this.handle.createWritable();
      try {
        await writer.write(data);
        await writer.close();
      } catch (err) {
        try { await writer.abort(); } catch (_) {}
        throw err;
      }
    },

    //directory listing, as Entry objects with paths relative to this one
    list: async function() {
      var out = [];
      var base = this.fullPath.replace(/\/$/, "");
      for await (var handle of this.handle.values()) {
        out.push(new Entry(handle, base + "/" + handle.name));
      }
      return out;
    },

    isSame: function(other) {
      if (!other || !other.handle) return Promise.resolve(false);
      return this.handle.isSameEntry(other.handle);
    },

    //returns "granted", "prompt", or "denied". Requesting (interactive) only
    //works in response to a user gesture, like a click or keypress.
    permission: async function(interactive) {
      if (!this.handle.queryPermission) return "granted";
      var options = { mode: "readwrite" };
      var state = await this.handle.queryPermission(options);
      if (state == "granted" || !interactive) return state;
      return this.handle.requestPermission(options);
    }
  };

  Entry.wrap = function(handle, fullPath) {
    return new Entry(handle, fullPath);
  };

  //the ID is assigned once per entry, so repeated retention is cheap
  Entry.retain = function(entry) {
    if (!entry.retainId) {
      entry.retainId = uuid();
      handles.put(entry.retainId, entry.handle).catch(err => console.error("Unable to retain handle", err));
    }
    return entry.retainId;
  };

  Entry.restore = async function(id) {
    var handle = await handles.get(id);
    if (!handle) return null;
    var entry = new Entry(handle);
    entry.retainId = id;
    return entry;
  };

  return Entry;

});
