define([
  "command",
  "ui/projectManager",
  "storage/entry"
], function(command, projectManager, Entry) {

  //handles is a list of FileSystemFileHandle/FileSystemDirectoryHandle objects
  command.on("session:open-dragdrop", function(handles) {
    var files = [];
    handles.forEach(function(handle) {
      var entry = Entry.wrap(handle);
      if (entry.isFile) {
        //files get opened in a tab
        files.push(entry);
      } else if (entry.isDirectory) {
        //directories get added to project
        projectManager.insertDirectory(entry);
      }
    });
    if (files.length) command.fire("session:open-entries", files);
  });

  document.body.addEventListener("dragover", function(e) {
    e.preventDefault();
  });

  document.body.addEventListener("drop", async function(e) {
    e.preventDefault();
    if (e.dataTransfer.types.indexOf("Files") === -1) return;
    //drag items are only valid during the event itself, so request every
    //handle now and wait for them afterwards
    var pending = Array.from(e.dataTransfer.items)
      .filter(item => item.kind == "file" && item.getAsFileSystemHandle)
      .map(item => item.getAsFileSystemHandle());
    var handles = (await Promise.all(pending)).filter(handle => handle);
    command.fire("session:open-dragdrop", handles);
  });

});
