define([
    "sessions",
    "editor",
    "storage/file",
    "ui/dialog",
    "command",
    "storage/settingsProvider",
    "storage/nullfile",
    "util/i18n",
    "util/platform",
    "storage/entry",
    "util/permissions",
    //these next modules are self-contained
    "sessions/dragdrop",
    "sessions/autosave"
  ], function(sessions, editor, File, dialog, command, Settings, NullFile, i18n, sys, Entry, permissions) {
    
  /*
  FileManager splits out the session code that specifically deals with I/O.
  Pretty much the whole file is just bindings to various commands.
  
  Now that session.js is refactored, this could probably move into a submodule,
  except that it gets loaded explicitly on startup.
  */

  command.on("session:new-file", content => sessions.addFile(content));
  
  //opens a list of Entry objects in tabs, switching to tabs that are already open
  command.on("session:open-entries", async function(entries) {
    for (var entry of entries) {
      var existing = null;
      for (var tab of sessions.getAllTabs()) {
        if (!tab.file || tab.file.virtual) continue;
        if (await tab.file.isSame(new File(entry))) {
          existing = tab;
          break;
        }
      }
      if (existing) {
        sessions.setCurrent(existing);
        continue;
      }
      try {
        var f = new File(entry);
        var data = await f.read();
        sessions.addFile(data, f);
      } catch (err) {
        dialog(err.message || String(err));
      }
    }
  });

  command.on("session:open-file", async function() {
    //have to call chooseEntry manually to support multiple files
    var args = {
      type: "openWritableFile",
      acceptsMultiple: true
    };
    var files = await sys.fileSystem.chooseEntry(args);
    if (!files) return;
    if (!files.slice) files = [ files ];
    await command.fire("session:open-entries", files);
  });
  
  command.on("session:save-file", async function() {
    await sessions.getCurrent().save()
    command.fire("session:syntax");
  });
  
  command.on("session:save-all", async function() {
    var tabs = sessions.getAllTabs();

    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      if (tab.modified && tab.file) await tab.save(false);
      command.fire("session:syntax");
    }

  });
  
  command.on("session:save-file-as", async function() {
    var tab = sessions.getCurrent();
    await tab.save(true);
    var mode = tab.detectSyntax();
    sessions.renderTabs();
    await command.fire("session:syntax", mode);
  });
  
  command.on("session:revert-file", async function() {
    var tab = sessions.getCurrent();
    if (!tab.file) return;
    var data = await tab.file.read();
    editor.setValue(data);
    tab.modified = false;
    tab.modifiedAt = new Date();
    sessions.renderTabs();
  });

  //we now autoretain starting after load, every n seconds
  var retainInterval = 5
  var retainLoop = async function(c) {
    var tabs = sessions.getAllTabs();
    var keep = [];
    tabs.forEach(function(tab, i) {
      if (!tab.file || tab.file.virtual) return;
      keep[i] = tab.file.retain();
    });
    keep = keep.filter(m => m);
    await sys.storage.local.set({ retained: keep });
    setTimeout(retainLoop, retainInterval * 1000);
  };

  command.on("session:check-file", async function() {
    if (Settings.get("user").disableReload) return;
    var tab = sessions.getCurrent();
    if (!tab.file || tab.file.virtual) return;
    var stat;
    try {
      stat = await tab.file.stat();
    } catch (err) {
      //the file may have been moved or deleted, or we may not have access
      return;
    }
    if (tab.modifiedAt && stat.lastModified > tab.modifiedAt.getTime()) {
      if (tab.modified) {
        var confirmed = await dialog(
          i18n.get("dialogModifiedBackground"),
          [
            {label: i18n.get("dialogReload"), value: true},
            {label: i18n.get("dialogCancel"), value: false, focus: true}
          ]
        );
        if (confirmed) {
          command.fire("session:revert-file");
        } else {
          tab.modifiedAt = new Date();
        }
      } else {
        command.fire("session:revert-file");
      }
    }
  });
  
  command.on("session:open-settings-file", async function(name) {
    await Settings.load(name);
    var data = Settings.getAsString(name);
    var file = Settings.getAsFile(name);
    sessions.addFile(data, file);
  });
  
  //defaults don't get loaded as files, just as content
  command.on("session:open-settings-defaults", async function(name) {
    await Settings.load(name);
    var text = Settings.getAsString(name, true);
    var tab = sessions.addFile(text);
    tab.syntaxMode = "javascript";
    tab.detectSyntax();
    tab.fileName = name + ".json";
    tab.file = new NullFile(text);
  });
  
  command.on("session:insert-from-file", async function() {
    var f = new File();
    await f.open();
    var text = await f.read();
    editor.execCommand("insertstring", text);
  });
  
  //files opened via the operating system (an installed PWA's file handler) arrive here
  var listenForLaunches = function() {
    if (!("launchQueue" in window)) return;
    launchQueue.setConsumer(function(params) {
      if (!params.files || !params.files.length) return;
      var entries = params.files.map(handle => Entry.wrap(handle));
      command.fire("session:open-entries", entries);
    });
  };
  
  var openFromRetained = async function() {
    var data = await sys.storage.local.get("retained");
    var failures = [];
    var candidates = [];
    var restored = [];
    if (!data.retained || !data.retained.length) return;
    
    //convert raw retained IDs into typed retention objects
    var retained = data.retained.map(function(item) {
      if (typeof item == "string") {
        return {
          type: "file",
          id: item
        };
      }
      return item;
    });
    
    //constructors for restorable types
    var restoreTypes = {
      file: File,
      settings: null, //not yet, will be regular SyncFile
      buffer: null //not yet, will be HTML5 filesystem for scratch files
    }
    
    //try to restore items in order
    for (var i = 0; i < retained.length; i++) {
      var item = retained[i];
      var Type = restoreTypes[item.type] || File;
      var file = new Type();
      try {
        await file.restore(item.id);
        candidates.push({ item, file });
      } catch(err) {
        console.log("Fail restore", err, file);
        failures.push(item);
      }
    }

    //browsers forget file permissions between sessions, so we may have to ask.
    //Files the user declines are simply not reopened.
    var allowed = await permissions.ensure(candidates.map(c => c.file.entry), "permissionReopenFiles");
    for (var c of candidates) {
      if (allowed.indexOf(c.file.entry) == -1) continue;
      try {
        var contents = await c.file.read();
        restored.push({ value: contents, file: c.file });
      } catch(err) {
        console.log("Fail read", err, c.file);
        failures.push(c.item);
      }
    }
    for (var i = 0; i < restored.length; i++) {
      var tab = restored[i];
      sessions.addFile(tab.value, tab.file);
    }
    if (!failures.length) {
      return;
    }

    var local = await sys.storage.local.get("retained");
    if (!local.retained) return;
    await sys.storage.local.set({
      retained: local.retained.filter(function(d) {
        // convert old retained IDs to new-style objects
        if (typeof d == "string") {
          d = {
            type: "file",
            id: d
          };
        }
        // remove failures from the set
        return !failures.some(fail => fail.type == d.type && fail.id == d.id);
      })
    });
  }
  
  var init = async function() {
    var data = await Settings.pull("user");
    if (data.user.disableTabRestore) {
      listenForLaunches();
      return "fileManager";
    } else {
      await openFromRetained();
      listenForLaunches();
      //start the retention process
      retainLoop();
      return "fileManager";
    }
  };
  
  command.on("init:startup", init);
  
  window.addEventListener("focus", command.fire.bind(null, "session:check-file"));

});
