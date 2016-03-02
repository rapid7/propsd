'use strict';
const http = require('http');
const fs = require('fs');
const Path = require('path');

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const DEFAULT_HTTP_PORT = 8080;

const metadata = JSON.parse(fs.readFileSync(Path.resolve(__dirname, '../data/test-metadata.json')));

function deepGet(root, path) {
  let twig = root,
      result = null;

  path.split('/').forEach((branch, index, branches) => {
    if (branch) {
      if (index < branches.length - 1) {
        twig = twig[branch];
      } else {
        result = twig && twig[branch];
      }
    }
  });
  return result;
}

const server = http.createServer((request, response) => {
  const slash = /\/$/.test(request.url);
  const item = deepGet(metadata, request.url.replace(/\/$/, ''));
  let code = HTTP_OK, body = '';

  if (typeof item === 'undefined') {
    code = HTTP_NOT_FOUND;
    body = '404 not found';
  } else if (item === null) {
    body = '';
  } else if (typeof item === 'object') {
    if (slash) {
      // if request has a trailing slash return the keys of the children, plus a trailing slash for child objects
      body = Object.keys(item).map((key) => key + (typeof item[key] === 'object' ? '/' : '')).join('\n');
    } else {
      // if request has no trailing slash, no soup for you
      body = '';
    }
  } else {
    body = item.toString();
  }
  response.writeHead(code, {'Content-Length': body.length, 'Content-Type': 'text/plain'});
  response.end(body);
});

const sockets = {};
let nextSocketId = 0;

server.on('listening', () => {
  console.log(`listening for metadata requests at http://127.0.0.1:${DEFAULT_HTTP_PORT}`); // eslint-disable-line
  // no-console
});

server.on('connection', (socket) => {
  const socketId = nextSocketId++;

  sockets[socketId] = socket;

  socket.on('close', () => {
    delete sockets[socketId];
  });
});

exports.start = () => { server.listen(DEFAULT_HTTP_PORT, '127.0.0.1'); };
exports.stop = () => {
  server.close();
  for (const socketId in sockets) {
    if (sockets.hasOwnProperty(socketId)) {
      sockets[socketId].destroy();
    }
    console.log('Server shutting down\n'); // eslint-disable-line no-console
  }
};
