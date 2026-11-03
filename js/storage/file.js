define([
    "storage/entry",
    "util/platform"
  ], function(Entry, sys) {

  /*

  The File object provides storage backed by the local disk via the File
  System Access API. Its "entry" is a storage/entry wrapper around a file
  handle.

  */

  var noop = function() {};

  var File = function(entry) {
    this.entry = entry || null;
    this.onWrite = noop;
  };

  File.prototype = {
    //mode is "open" or "save"
    open: async function(mode, suggestedName) {
      var entry = await sys.fileSystem.chooseEntry({
        type: mode == "save" ? "saveFile" : "openWritableFile",
        suggestedName: suggestedName
      });
      //cancelling isn't an error from the browser, but callers treat it like one
      if (!entry) throw new Error("User cancelled");
      this.entry = entry;
    },

    read: async function() {
      if (!this.entry) {
        console.error(this);
        throw new Error("File not opened");
      }
      try {
        return await this.entry.read();
      } catch (err) {
        console.error("File read error!", err);
        throw err;
      }
    },

    write: async function(data) {
      //guard against cases where we accidentally write before opening
      if (!this.entry) {
        await this.open("save");
      }

      //permission may have lapsed since the file was restored. Writes usually
      //come from a key press or click, so we can ask for it back here.
      if (await this.entry.permission(false) != "granted") {
        await this.entry.permission(true);
      }

      try {
        await this.entry.write(data);
      } catch (err) {
        console.error(err);
        throw err;
      }
      this.onWrite();
    },

    stat: async function() {
      if (!this.entry) throw "No file entry";
      return this.entry.getFile();
    },

    //true if both files are backed by the same file on disk
    isSame: async function(other) {
      if (!this.entry || !other || !other.entry || !other.entry.isSame) return false;
      return this.entry.isSame(other.entry);
    },

    retain: function() {
      var id = sys.fileSystem.retainEntry(this.entry);
      return {
        type: "file",
        id: id
      };
    },

    restore: async function(id) {
      var entry = await sys.fileSystem.restoreEntry(id);
      if (!entry) throw "restoreEntry() failed for " + id;
      this.entry = entry;
      return entry;
    },

    getPath: async function() {
      if (!this.entry) throw "No backing entry, cannot get path";
      return this.entry.fullPath;
    }
  };

  return File;

});
