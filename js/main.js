require([
    "command",
    "editor",
    "storage/settingsProvider",
    "ui/dialog",
    "sessions",
    "util/i18n",
    "util/platform",
    "fileManager",
    "api",
    "sequences",
    "ui"
  ], function(command, editor, Settings, dialog, sessions, i18n, sys) {

  //translate inline strings
  i18n.page();

  //these are modules that must be loaded before init:complete
  var loadedModules = {
    "editor": false,
    "fileManager": false,
    "sessions": false
  };

  //the settings manager may also fire init:restart to re-init components after startup
  command.fire("init:startup", function(mod) {
    //ignore callback in non-essential modules
    if (typeof loadedModules[mod] == "undefined") return;
    loadedModules[mod] = true;
    for (var key in loadedModules) {
      if (!loadedModules[key]) {
        return;
      }
    }
    //all specified modules are loaded, app is ready for init:complete
    command.fire("init:complete");
  });

  /*
  Updates are delivered by the service worker (sw.js). A new version downloads
  in the background and waits; we ask before switching over, because the swap
  reloads the page. The "promptForUpdates" setting turns off the automatic
  prompt, but a manual "Check for Updates" always reports what it finds.
  */
  var autoPrompt = true;
  var manualCheck = false;

  var offerUpdate = async function(worker) {
    var value = await dialog(
      i18n.get("notificationUpdateReady"),
      [
        { label: i18n.get("notificationUpdateOK"), value: true, shortcut: "y" },
        { label: i18n.get("notificationUpdateWait"), value: false, shortcut: "n", focus: true }
      ]
    );
    if (value) {
      //the controllerchange listener below does the reload
      worker.postMessage({ type: "SKIP_WAITING" });
    }
  };

  var watchRegistration = function(registration) {
    registration.addEventListener("updatefound", function() {
      var worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", function() {
        //without a controller, this is the first install, not an update
        if (worker.state == "installed" && navigator.serviceWorker.controller) {
          if (autoPrompt || manualCheck) offerUpdate(worker);
          manualCheck = false;
        }
      });
    });
  };

  var checkUpdates = async function(isManual) {
    if (!("serviceWorker" in navigator)) return;
    var registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    manualCheck = !!isManual;
    try {
      await registration.update();
    } catch (err) {
      console.warn("Update check failed", err);
    }
    if (registration.waiting) {
      manualCheck = false;
      return offerUpdate(registration.waiting);
    }
    //if a new version is still installing, the listener above offers it when it's ready
    if (registration.installing) return;
    manualCheck = false;
    if (isManual) {
      dialog(i18n.get("notificationNoUpdateDetail"));
    }
  };

  var registerWorker = async function() {
    if (!("serviceWorker" in navigator)) return;
    var cfg = await Settings.pull("user");
    autoPrompt = cfg.user.promptForUpdates !== false;
    //we only reload on controllerchange if there was already a controller;
    //the very first install claims the page, and that's no reason to reload
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function() {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
    try {
      var registration = await navigator.serviceWorker.register("sw.js");
      watchRegistration(registration);
      //an update may have been downloaded in an earlier session
      if (registration.waiting && hadController && autoPrompt) {
        offerUpdate(registration.waiting);
      }
    } catch (err) {
      console.warn("Service worker registration failed", err);
    }
  };

  registerWorker();
  command.on("app:check-for-updates", checkUpdates);

  //anything with unsaved work should get a chance to be saved
  var hasUnsavedWork = function() {
    return sessions.getAllTabs().some(tab => tab.modified && (!tab.file || !tab.file.virtual));
  };
  var closing = false;

  window.addEventListener("beforeunload", function(e) {
    if (closing || !hasUnsavedWork()) return;
    e.preventDefault();
    e.returnValue = "";
  });

  command.on("app:exit", async function() {
    var cancelled = false;
    var tabs = sessions.getAllTabs();
    for (var tab of tabs) {
      if (tab.modified && (!tab.file || !tab.file.virtual)) {
        var value = await dialog(
          i18n.get("dialogUnsaved", tab.fileName),
          [
            { label: i18n.get("dialogSave"), value: "save", shortcut: "s" },
            { label: i18n.get("dialogDiscard"), value: "discard", shortcut: "n" },
            { label: i18n.get("dialogCancel"), value: "cancel", shortcut: "c" }
          ]);
        if (!value || value == "cancel") {
          cancelled = true;
          break;
        }
        if (value == "save") {
          await tab.save();
        }
      }
    }
    if (!cancelled) {
      //the user has already decided what to do about unsaved tabs
      closing = true;
      window.close();
      //browsers refuse to close tabs that weren't opened by script
      setTimeout(function() { closing = false; }, 500);
    }
  });

  //It's nice to be able to launch the debugger from a command stroke
  command.on("app:debug", function() {
    debugger;
  });

  command.on("app:browse", function(url) {
    window.open(url, "target=_blank");
  });

});
