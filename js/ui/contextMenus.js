define(function() {

  /*

  Context menus for links inside the page (tabs, project folders). Chrome Apps
  could register these with the browser; on the web we draw our own. Menu
  items are registered against "routes" like "tabs/:id", which are matched
  against the href of the link that was right-clicked.

  */

  //every registered item, in the order they were added
  var registry = [];
  var openMenu = null;

  //builds the href that a link should carry to receive menus for a route
  var makeURL = function(filter, id) {
    var url = filter;
    if (typeof id != "undefined") {
      url += "/" + id;
    }
    return url;
  };

  var createRoute = function(route, handler) {
    var parts = route.split("/");
    var positionMap = {};
    var position = 1;
    parts = parts.map(function(s) {
      if (s[0] == ":") {
        //set the key to be used on parsing
        positionMap[position++] = s.replace(/^:/, "");
        return "*";
      }
      return s.replace(/[\^()\[\]]/, function(match) { return "\\" + match });
    });
    var re = new RegExp("^" + parts.map(function(s) { return s == "*" ? "([^\/]+)" : s }).join("\\/") + "$");
    var parser = function(url) {
      var result = re.exec(url);
      if (!result) return result;
      var params = {};
      for (var place in positionMap) {
        var key = positionMap[place];
        params[key] = result[place];
      }
      params.url = url;
      return params;
    };
    return {
      parse: parser,
      regex: re,
      callback: handler
    };
  };

  var closeMenu = function() {
    if (!openMenu) return;
    openMenu.remove();
    openMenu = null;
  };

  var showMenu = function(x, y, items) {
    closeMenu();
    var ul = document.createElement("ul");
    ul.className = "context-menu";
    items.forEach(function(item) {
      var li = document.createElement("li");
      li.textContent = item.label;
      li.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        item.run();
      });
      ul.appendChild(li);
    });
    document.body.appendChild(ul);
    //keep the menu on screen
    var box = ul.getBoundingClientRect();
    ul.style.left = Math.max(0, Math.min(x, window.innerWidth - box.width)) + "px";
    ul.style.top = Math.max(0, Math.min(y, window.innerHeight - box.height)) + "px";
    openMenu = ul;
  };

  document.addEventListener("contextmenu", function(e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href");
    var items = [];
    registry.forEach(function(entry) {
      var params = entry.parse(href);
      if (!params) return;
      items.push({
        label: entry.label,
        run: () => entry.callback(params)
      });
    });
    if (!items.length) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY, items);
  });

  document.addEventListener("mousedown", function(e) {
    if (openMenu && !openMenu.contains(e.target)) closeMenu();
  }, true);
  document.addEventListener("keydown", function(e) {
    if (e.keyCode == 27) closeMenu();
  }, true);
  window.addEventListener("blur", closeMenu);
  window.addEventListener("resize", closeMenu);

  return {
    register: function(label, id, route, handler) {
      var compiled = createRoute(route, handler);
      compiled.label = label;
      compiled.id = id;
      registry.push(compiled);
    },
    makeURL: makeURL
  };

});
