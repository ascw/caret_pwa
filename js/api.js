define([
    "command",
    "settings!api"
  ], function(command, Settings) {

  /*

  In the Chrome App, Caret could message other apps and extensions (build
  systems, linters) and accept commands from them via chrome.runtime
  messaging. Web apps have no equivalent, so api:execute now does nothing
  except tell you so in the console. The "api" settings are still loaded so
  that existing configuration files keep working.

  */

  var noop = function() {};

  command.on("api:execute", function(id, c = noop) {
    console.warn("api:execute is not supported in the web version of Caret (" + id + ")");
    c();
  });

});
