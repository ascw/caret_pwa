*NOTE: Chrome Apps no longer run on Chrome OS, so Caret has been converted to a Progressive Web App (PWA). See "Moving from the Chrome App" below. This conversion was done by claude sonnet and deepseek v4.1 flash. The agents only convert, and original author's notes were kept inside this folder.*

Caret
=====

Caret is a lightweight-but-powerful programmer's editor that installs as a
Progressive Web App. Inspired by Sublime and built on top of the Ace editing
component, it offers:

-  multiple cursors
-  tabbed editing and retained files
-  syntax highlighting and themes
-  command palette/smart go to
-  hackable configuration files
-  project files and folder view
-  fast project-wide string search

Documentation can be found in the
`wiki <https://github.com/thomaswilburn/Caret/wiki>`_.

Running Caret
-------------

Caret needs a Chromium-based browser (Chrome, Edge, Chrome OS) because it
edits your files directly through the File System Access API. You'll need Node
and NPM installed first, then:

1. Run ``npm install`` to get the development dependencies (Grunt, LESS)
2. Run ``npm run build``, which generates the CSS from the LESS source and
   the file list the service worker uses to work offline
3. Run ``npm start`` and open http://localhost:8080
4. Use the install icon in the address bar (or the browser menu's "Install
   Caret") to add it as an app. Installing is optional, but it's what lets
   Caret appear in the Chrome OS launcher, open in its own window, and be
   offered as an editor for text files.

To publish Caret for other people, host the project folder (after
``npm run build``) on any static web server over HTTPS, such as GitHub Pages.
Re-run ``npm run build`` whenever anything changes, which also tells the
service worker that there is a new version to offer to users.

Moving from the Chrome App
--------------------------

The Chrome App's settings can't be read by a web app, so Caret starts fresh. To
bring your configuration over, open each settings file from the Settings menu
in the old version, then paste its text into the same file here. A few things
work differently on the web:

-  Files and folders can't be addressed by real disk paths, so Caret shows
   paths relative to the folder you opened (``/project/src/file.js``). The
   "copy path" menu item copies that.
-  Browsers forget file permissions between sessions, so when Caret restores
   your tabs or project folders at startup it asks for your OK first.
-  Settings are stored in the browser on this device and are no longer
   synchronized between devices.
-  The ``api:execute`` messaging to other Chrome apps and extensions has no web
   equivalent and has been removed.
-  The window frame belongs to the browser, so the minimize/maximize buttons
   are gone. "Maximize" now toggles fullscreen.
