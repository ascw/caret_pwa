define([
    "settings!menus,keys",
    "editor",
    "ui/dialog",
    "command",
    "util/template!templates/menuItem.html",
    "util/i18n",
    "util/platform"
  ], function(Settings, editor, dialog, command, inflate, i18n, sys) {
    
  //default "Windows", will be adjusted during menu creation because async
  var platform = "win";
  
  // walker() renders the menu and returns a document fragment
  var walker = function(list, depth) {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (typeof entry == "string") {
        var preset;
        switch (entry) {
          case "divider":
            preset = document.createElement("hr");
            break;
          //other special string keys go here - spacer? dynamic menus?
        }
        fragment.appendChild(preset);
        continue;
      }
      //version testing to hide entries that this version of Chrome can't run
      //originally for project support, should remove soon
      if (entry.minVersion && entry.minVersion > sys.browserVersion) {
        continue;
      }
      var isAce = entry.command == "ace:command";
      var keyCombo = isAce ? findKeyCombo(entry.argument) : findKeyCombo(entry.command, entry.argument);
      if (keyCombo && platform == "mac") {
        //special snowflake keyboard adjustment
        keyCombo = keyCombo
          .replace("Command-", "Cmd-")
          .replace("Ctrl-", "Cmd-")
          .replace("Alt-", "Option-");
      }
      var data = {
        command: entry.command,
        argument: entry.argument,
        shortcut: keyCombo,
        hasChildren: entry.sub && !!entry.sub.length,
        isRoot: !depth,
        tabIndex: depth ? -1 : 0,
        retainFocus: entry.retainFocus,
        label: i18n.get(entry.label)
      };
      var element = inflate.get("templates/menuItem.html", data);
      //an empty "sub" list renders no <ul>, so there is nothing to fill
      var ul = entry.sub && element.querySelector("ul");
      if (ul) {
        ul.appendChild(walker(entry.sub, depth + 1));
      }
      fragment.appendChild(element);
    }
    return fragment;
  };

  var capitalizeAceKeys = function(s) {
    return s.replace(/(^\w|\b\w)/g, function(l) { return l.toUpperCase() });
  };

  var testAceBinding = function(key, binding, command) {
    if (typeof binding == "string" && binding == command) {
      return key;
    } else if (binding instanceof Array) {
      for (var i = 0; i < binding.length; i++) {
        var b = testAceBinding(key, binding[i], command);
        if (b) return b;
      }
    } else if (binding.name == command && binding.bindKey[platform]) {
      return binding.bindKey[platform].split("|").shift();
    }
    return false;
  };
  
  // We load match commands to the key config, so they're always current
  var findKeyCombo = function(command, arg) {
    var keys = Settings.get("keys");
    var handler = editor.keyBinding.getKeyboardHandler();
    var ckb = handler.commandKeyBinding;
    //check key config
    for (var key in keys) {
      var action = keys[key];
      if (!action) continue;
      var verb = action.ace || action.command || action;
      var object = action.argument;
      if (verb == command) {
        if (arg && object !== arg) continue;
        //transform old keys and lower-case
        key = key
          //back-compat
          .replace(/(\^|M)-([A-Z]+)$/, "$1-Shift-$2")
          .replace(/\^-/g, "Ctrl-")
          .replace(/M-/g, "Alt-")
          //capitalize keys for lazy people
          .replace(/(^|-)([a-z])/g, function(match) { return match.toUpperCase(); });
        return key;
      }
    }
    //fall back to Ace defaults
    if (command) for (var k in ckb) {
      var binding = testAceBinding(k, ckb[k], command);
      if (binding) return capitalizeAceKeys(binding);
    }
    return false;
  };
  
  var Menu = function() {
    this.element = document.querySelector(".toolbar");
    this.active = false;
    this.bindEvents();
  };
  Menu.prototype = {
    create: async function() {
      var cfg = Settings.get("menus");
      var info = await sys.runtime.getPlatformInfo();
      if (info.os == "mac") platform = "mac";
      var elements = walker(cfg, 0);
      this.element.innerHTML = "";
      this.element.appendChild(elements);
    },
    bindEvents: function() {
      var self = this;
      var menubar = this.element;

      var positionTopMenu = function(top) {
        var menu = top.querySelector(":scope > .menu");
        if (!menu) return;
        menu.classList.remove("align-right");
        if (menu.getBoundingClientRect().right > window.innerWidth - 8) {
          menu.classList.add("align-right");
        }
      };

      // Submenus are fixed-position so that a scrollable first-level menu
      // can't clip them, and so that they can flip near the window edges.
      var positionSubmenu = function(parent) {
        var menu = parent.querySelector(":scope > .menu");
        if (!menu) return;
        var parentRect = parent.getBoundingClientRect();
        var menuRect = menu.getBoundingClientRect();

        var left = parentRect.right - 16;
        if (left + menuRect.width > window.innerWidth - 8) {
          left = parentRect.left - menuRect.width;
        }
        left = Math.max(8, left);

        var top = parentRect.top - 4;
        if (top + menuRect.height > window.innerHeight - 8) {
          top = window.innerHeight - menuRect.height - 8;
        }
        top = Math.max(8, top);

        menu.style.left = left + "px";
        menu.style.top = top + "px";
      };

      var openTop = function(top) {
        self.deactivate();
        top.classList.add("active");
        self.active = true;
        positionTopMenu(top);
      };

      var closeSubmenus = function(except) {
        menubar.querySelectorAll(".parent.open").forEach(function(node) {
          if (node !== except) node.classList.remove("open");
        });
      };

      var openSubmenu = function(parent) {
        closeSubmenus(parent);
        parent.classList.add("open");
        positionSubmenu(parent);
      };

      var visibleItems = function(menu) {
        return Array.from(menu.children).filter(function(item) {
          return item.matches("li") && item.getClientRects().length;
        });
      };

      var focusItem = function(menu, index) {
        var items = visibleItems(menu);
        if (!items.length) return;
        index = Math.max(0, Math.min(index, items.length - 1));
        items[index].focus();
      };

      var focusFirst = function(parent) {
        var menu = parent.querySelector(":scope > .menu");
        if (menu) focusItem(menu, 0);
      };

      var scrollFrame = null;
      var reposition = function() {
        if (scrollFrame) return;
        scrollFrame = window.requestAnimationFrame(function() {
          scrollFrame = null;
          menubar.querySelectorAll(".parent:hover, .parent.open").forEach(positionSubmenu);
        });
      };

      document.addEventListener("click", function(e) {
        if (!self.active) return;
        if (menubar.contains(e.target)) return;
        self.deactivate();
      });

      menubar.addEventListener("click", function(e) {
        var el = e.target.closest("li");
        if (!el || !menubar.contains(el)) return;
        if (el.classList.contains("top")) {
          e.preventDefault();
          if (el.classList.contains("active")) {
            self.deactivate();
          } else {
            openTop(el);
          }
        } else if (el.classList.contains("parent")) {
          e.preventDefault();
          openSubmenu(el);
        } else {
          // A command was selected: dismiss the menu, then let the global
          // command handler fire it.
          self.deactivate();
        }
        if (!self.active && !el.classList.contains("no-refocus")) {
          editor.focus();
        }
      });

      menubar.addEventListener("mouseover", function(e) {
        var parent = e.target.closest("li.parent");
        if (parent) {
          if (!parent.classList.contains("open")) closeSubmenus(parent);
          positionSubmenu(parent);
          return;
        }
        var top = e.target.closest("li.top");
        if (top && self.active && !top.classList.contains("active")) openTop(top);
      });

      menubar.addEventListener("scroll", reposition, true);
      window.addEventListener("resize", function() {
        if (!self.active) return;
        var top = menubar.querySelector(":scope > li.active");
        if (top) positionTopMenu(top);
        menubar.querySelectorAll(".parent:hover, .parent.open").forEach(positionSubmenu);
      });

      document.addEventListener("keydown", function(e) {
        if (e.key != "Escape" || !self.active) return;
        e.preventDefault();
        var top = menubar.querySelector(":scope > li.active");
        self.deactivate();
        if (top) top.focus();
      });

      menubar.addEventListener("keydown", function(e) {
        var el = e.target.closest("li");
        if (!el || !menubar.contains(el)) return;

        if (el.classList.contains("top")) {
          if (e.key == "ArrowDown") {
            e.preventDefault();
            if (!el.classList.contains("active")) openTop(el);
            focusFirst(el);
          } else if (e.key == "ArrowRight" || e.key == "ArrowLeft") {
            e.preventDefault();
            var tops = Array.from(menubar.children);
            var next = tops[(tops.indexOf(el) + (e.key == "ArrowRight" ? 1 : tops.length - 1)) % tops.length];
            next.focus();
            if (self.active) openTop(next);
          } else if (e.key == "Enter" || e.key == " ") {
            e.preventDefault();
            el.click();
          }
          return;
        }

        if (e.key == "ArrowDown" || e.key == "ArrowUp") {
          e.preventDefault();
          var items = visibleItems(el.parentElement);
          var index = items.indexOf(el) + (e.key == "ArrowDown" ? 1 : -1);
          focusItem(el.parentElement, index);
        } else if (e.key == "ArrowRight") {
          if (el.classList.contains("parent")) {
            e.preventDefault();
            openSubmenu(el);
            focusFirst(el);
          }
        } else if (e.key == "ArrowLeft") {
          e.preventDefault();
          var parentItem = el.parentElement.parentElement;
          if (parentItem.classList.contains("parent")) {
            parentItem.classList.remove("open");
            parentItem.focus();
          } else {
            var top = menubar.querySelector(":scope > li.active");
            if (top) top.focus();
          }
        } else if (e.key == "Enter" || e.key == " ") {
          e.preventDefault();
          el.click();
        }
      });
    },
    deactivate: function() {
      this.element.querySelectorAll(".active").forEach(node => node.classList.remove("active"));
      this.element.querySelectorAll(".parent.open").forEach(node => node.classList.remove("open"));
      this.active = false;
    }
  };
  
  var menu = new Menu();
  
  command.on("init:startup", menu.create.bind(menu));
  command.on("init:restart", menu.create.bind(menu));

  command.on("app:about", function() {
    inflate.load("templates/about.html").then(function() {
      dialog(
        inflate.getHTML("templates/about.html", {
          version: window.CARET_VERSION || ""
        })
      );
    });
  });
  
  return menu;
  
});