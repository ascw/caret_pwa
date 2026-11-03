Module descriptions - util
==========================

aceLoad.js
----------

Shims Ace's loadScript() async loader so that AMD modules can simply
declare Ace dependencies the same way they declare AMD dependencies.

platform.js
-----------

Wraps the browser features that Caret depends on (file pickers and handle
retention, key/value storage, platform detection) using Promises for easy
interop with ``async`` and ``await``. This replaces the old ``chrome.*`` Apps
APIs.

permissions.js
--------------

Browsers forget file and folder permissions between sessions. ``ensure()``
takes a list of entries and, if any need permission, shows a single dialog and
requests it as part of the user's click. Resolves to the entries that can be
used.

i18n.js
-------

Gets translated strings from the language files in _locales, which
``js/bootstrap.js`` loads (merged over English) before the app starts.

inflate.js
----------

Chrome OS disallows using ``eval()`` or ``new Function()``, which means
many template libraries simply won't work without pre-compiling the
templates. Instead of going that route, recognizing that template speed
is almost never a bottleneck for Caret, inflate.js provides
Mustache-compatible templating that can load from the filesystem or the
DOM (loaded automatically by ID). Exposes the following methods:

-  ``load``- Pulls a template from the given filesystem path. Returns a
   promise that resolves when the template is ready.
-  ``loadHTML`` - Directly insert HTML into the template cache for use.
-  ``get`` - Fills a template with data and returns a DOM element.
-  ``getHTML`` - Fills a template with data and returns the string
   representation
-  ``getAsync`` - Used to simultaneously load and fill a template.
   Returns a promise that resolves with the filled template as a DOM
   element.

template.js
-----------

A plugin that loads a template from disk, then returns the ``inflate``
templating object. Useful for modules that need a template as part of
their dependencies.

text.js
-------

A RequireJS plugin that loads files from Caret's app directory using
``fetch()``. Used to get the default settings JSON through a standard interface.
