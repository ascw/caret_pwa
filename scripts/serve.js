#!/usr/bin/env node
/*
A tiny static file server for trying Caret locally: `npm start`, then open
http://localhost:8080. Service workers, file handles, and the install prompt all
work on localhost without HTTPS. For anything else, host these files over HTTPS.

Usage: node scripts/serve.js [port]
*/

var http = require("http");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var port = Number(process.argv[2]) || Number(process.env.PORT) || 8080;

var types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

http.createServer(function(req, res) {
  var pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  var file = path.join(root, pathname);
  //stay inside the project, and out of node_modules and the repository
  var relative = path.relative(root, file);
  if (relative.startsWith("..") || /^(node_modules|\.git)(\/|$)/.test(relative)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(file, function(err, data) {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      //the service worker handles caching; don't let the HTTP cache get in its way
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}).listen(port, function() {
  console.log("Caret is running at http://localhost:" + port);
});
