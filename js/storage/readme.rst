Module descriptions - storage/\*
================================

file.js
-------

Wraps the File System Access API in a friendly File constructor. File objects
have the following methods or properties, most of which should be self
explanatory. All methods return promises, and can be used with the ``await``
keyword.

-  ``open``
-  ``read``
-  ``write``
-  ``stat``
-  ``retain``
-  ``restore``
-  ``getPath``
-  ``isSame`` - whether another File is backed by the same file on disk
-  ``entry`` - contains the actual entry object (see entry.js).

entry.js
--------

Wraps a file or directory handle from the File System Access API, giving it
``name``, ``isFile``, ``isDirectory``, a display ``fullPath``, and helpers to
read, write, list a directory, and check permissions. It's also how handles are
"retained" between sessions.

handles.js
----------

An IndexedDB store for file and directory handles, so that they can be restored
the next time Caret starts.

All storage in Caret, regardless of its actual backing structure, goes
through objects adhering to the File interface, which makes it much
easier to open many types of data through the same tab/editor UI. It
also makes persistence much more consistent and less verbose throughout
Caret.

nullfile.js
-----------

It's a file stub that does nothing when you try to interact with it--useful
for read-only tabs, like search results or config defaults.

settingsProvider.js
-------------------

The actual singleton returned when modules load configs via the
``settings`` plugin. Provides the following API:

-  ``get`` Retrieves the current settings object by name, with all
   layers \`(project, local, and default) merged over top each other.
-  ``getAsString`` Retrieves the local settings as a string, mostly used
   when opening settings for editing.
-  ``getAsFile``
-  ``load`` Requests a fresh copy of the local settings from sync
   storage, usually called after either writing to settings or when the
   dependent module does not have a settings cache.
-  ``setProject`` Sets the top-most JSON object to be merged when
   calling ``Settings.get()``, used for the project-specific settings
   overrides.
-  ``clearProject`` Removes the top-most JSON object, so that only local
   and default settings are merged.
-  ``pull`` Calls load/get for you on the list of arguments, and returns
   a promise that's fullfilled with a hash of the requested settings.

syncfile.js
-----------

A constructor matching the File interface, but backed by Caret's stored
settings. Used to open settings "files."

syncFS.js
---------

Stores settings files by name, in localStorage. Returns promises for all
methods.
