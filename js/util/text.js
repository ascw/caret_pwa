define(function() {

  /*
  A RequireJS plugin for loading text files (config JSON, templates), as in
  util/text!config/user.json. Paths are relative to the page.
  */

  var cache = {};

  return {
    load: function(name, parentRequire, onLoad, config) {
      if (name in cache) {
        return onLoad(cache[name]);
      }

      fetch(name).then(function(response) {
        if (!response.ok) throw new Error("Unable to load " + name + " (" + response.status + ")");
        return response.text();
      }).then(function(text) {
        cache[name] = text;
        onLoad(text);
      }).catch(function(err) {
        console.error(err);
        if (onLoad.error) onLoad.error(err);
      });
    }
  };

});
