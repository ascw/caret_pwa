define([
    "storage/syncFS",
    "command"
  ], function(sync, command) {

  /*

  SyncFile is a wrapper around Caret's stored settings (see storage/syncFS)
  that uses the same interface as the File module. This means you can assign a SyncFile
  containing Caret's settings JSON to a tab just as you would a regular file,
  and the tab can read/write from it without any customization. The one
  difference is the virtual flag, which is used to prevent some file-only
  behaviors (such as retaining the file for the next session).
  
  */
    
  var SyncFile = function(name) {
    this.entry = {};
    if (name) {
      this.open(name);
    }
    this.virtual = true;
  };
  SyncFile.prototype = {
    name: "",
    open: function(name) {
      this.name = name;
      this.entry.name = name;
      return this;
    },
    read: async function() {
      var name = this.name;
      return await sync.get(this.name)
    },
    write: async function(content) {
      await sync.set(this.name, content);
      command.fire("settings:change-local");
    },
    retain: function() { return false; },
    restore: function() { return Promise.reject("Cannot restore sync storage files") }
  };
  
  return SyncFile;
  
});