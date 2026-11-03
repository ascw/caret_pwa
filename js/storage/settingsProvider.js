define([
    "storage/syncFS",
    "storage/syncfile",
    "command",
    "util/platform"
  ], function(sync, SyncFile, command, sys) {

  var defaults = {};
  var local = {};
  var project = {};
  
  var clone = function(item) {
    var copy = function(value) {
      if (value instanceof Array) {
        return cloneArray(value);
      } else if (typeof value == "object") {
        return cloneObject(value);
      } else {
        return value;
      }
    };
    var cloneArray = function(a) {
      var n = [];
      for (var i = 0; i < a.length; i++) {
        n[i] = copy(a[i]);
      }
      return n;
    };
    var cloneObject = function(o) {
      var n = {};
      for (var key in o) {
        n[key] = copy(o[key]);
      }
      return n;
    };
    if (item instanceof Array) {
      return cloneArray(item);
    }
    return cloneObject(item);
  };
  
  //track transfers to prevent multiple requests
  var pending = {};

  var Settings = {
    get: function(name) {
      name = name + ".json";
      var comments = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
      //settings are normally loaded before get() runs, but a missing default
      //shouldn't take down the whole app
      if (typeof defaults[name] != "string") {
        console.warn("settings: no default for " + name);
        return {};
      }
      var original = clone(JSON.parse(defaults[name].replace(comments, "")));
      var custom;
      try {
        if (typeof local[name] == "string") {
          custom = JSON.parse(local[name].replace(comments, ""));
        }
      } catch (e) {
        //parse failed: fall through to the defaults
      }
      //flat arrays (like menus.json) just get returned, not merged
      if (custom && custom instanceof Array) {
        return custom;
      }
      for (var key in custom) {
        original[key] = custom[key];
      }
      //override settings with project settings
      for (var key in project) {
        original[key] = project[key];
      }
      return original;
    },
    getAsString: function(name, original) {
      name = name + ".json";
      if (original) {
        return defaults[name];
      }
      return local[name] || defaults[name];
    },
    getAsFile: function(name) {
      return new SyncFile(name + ".json");
    },
    loadDefault: function(name) {
      if (defaults[name]) return defaults[name];
      return new Promise(function(ok) {
        require(["util/text!config/" + name], function(raw) {
          defaults[name] = raw;
          ok();
        });
      });
    },
    load: function(name) {
      name = name + ".json";
      if (local[name]) {
        return local[name];
      }

      var self = this;
      if (!pending[name]) pending[name] = new Promise(async function(ok) {
        await self.loadDefault(name);
        var data = await sync.get(name);
        if (data) {
          local[name] = data;
        } else {
          local[name] = defaults[name];
        }
        ok();
        delete pending[name];
      });
        
      return pending[name];
      
    },
    setProject: function(settings) {
      project = settings;
      command.fire("settings:change-local");
    },
    clearProject: function() {
      project = {};
      command.fire("settings:change-local");
    },
    //load/get all requested settings via a promise
    pull: async function(...names) {
      var pending = names.map(n => Settings.load(n));
      await Promise.all(pending);
      var collected = {};
      names.forEach(function(name) {
        collected[name] = Settings.get(name);
      });
      return collected;
    }
  };

  command.on("settings:delete-local", function(key) {
    key += ".json";
    local[key] = defaults[key];
    sync.remove(key);
    command.fire("init:restart");
  });

  command.on("settings:change-local", async function() {
    //reload anything that's been used
    var keys = Object.keys(defaults).map(n => n.replace(".json", ""));
    local = {};
    var completed = keys.map(k => Settings.load(k));
    await Promise.all(completed);
    command.fire("init:restart");
  });
  
  command.on("settings:emergency-reset", function() {
    //unlike the menu item, let's confirm it here in case someone fat-fingers the menu/palette
    //the dialog module depends on the editor, which depends on us, so load it lazily
    //(RequireJS 2.1 ignores async functions as callbacks, so this one is plain)
    require(["ui/dialog"], function(dialog) {
      dialog(
        "This will wipe out all your settings and return Caret to its initial condition. Are you sure you want to do this?",
        [
          { label: "Yes, reset all data", value: true },
          { label: "Cancel emergency reset", value: false, focus: true }
        ]
      ).then(async function(confirmed) {
        if (!confirmed) return;
        await sys.reset();
        window.location.reload();
      });
    });
  });

  return Settings;

});