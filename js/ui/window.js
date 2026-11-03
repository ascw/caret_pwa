define([
  "command",
  "storage/settingsProvider"
], function(command, Settings) {

  /*

  Window behavior. As an installed PWA, the browser draws the window frame, so
  Caret only handles theming and fullscreen. The old minimize/maximize
  buttons are gone; "maximize" now toggles fullscreen.

  */

  var setTheme = async function() {
    var data = await Settings.pull("user");
    var themes = {
      "dark": "css/caret-dark.css",
      "twilight": "css/caret-twilight.css",
      "light": "css/caret.css"
    };
    var theme = data.user.uiTheme || "light";
    var url = themes[theme] || themes.dark;
    document.querySelector("#theme").setAttribute("href", url);
  };
  setTheme();
  command.on("init:restart", setTheme);

  var isFullscreen = () => !!document.fullscreenElement;

  command.on("app:maximize", async function() {
    try {
      if (isFullscreen()) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        //lets Escape reach the editor instead of leaving fullscreen
        if (navigator.keyboard && navigator.keyboard.lock) {
          navigator.keyboard.lock(["Escape"]).catch(() => {});
        }
      }
    } catch (err) {
      console.warn(err);
    }
    editor.focus();
  });

  command.on("app:restart", function() {
    window.location.reload();
  });

  //developer command for reloading CSS
  command.on("app:reload-css", function() {
    var link = document.querySelector("link#theme");
    link.href = link.href;
  });

  //handle immersive fullscreen
  document.addEventListener("fullscreenchange", async function() {
    if (!isFullscreen()) {
      document.body.classList.remove("fullscreened");
      document.body.classList.remove("immersive");
      editor.resize();
      return;
    }
    document.body.classList.add("fullscreened");
    var data = await Settings.pull("user");
    if (data.user.immersiveFullscreen) {
      document.body.classList.add("immersive");
      editor.resize();
    }
  });

  //kill middle clicks if not handled
  document.body.addEventListener("click", function(e) {
    if (e.button == 1) {
      e.preventDefault();
    }
  });

});
