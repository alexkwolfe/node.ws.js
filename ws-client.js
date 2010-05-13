/*
 * WebSocket NodeJS client 0.1
 *
 * Copyright 2010 Ivan Zuzak
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*

WebSocket client based on WebSocket server http://github.com/ncr/node.ws.js by Jacek Becela
Example usage for testing server available at http://www.websockets.org/:

var wsClient = createWSClient('ws://websockets.org:8787/');

wsClient.addListener('connect', function() {
  sys.puts("Connected!");
});

wsClient.addListener('data', function(chunk) {
  sys.puts("Received data: " + chunk);
});

wsClient.addListener('end', function() {
  sys.puts("Disconnected!");
});

setTimeout(function() {
  for(var i = 0; i<10; i++) {
    setTimeout(function() {
      wsClient.write("Hello WS world! " + Math.random().toString());
    }, i*200);
  }
}, 2000);

setTimeout(function() {
  wsClient.end();
}, 10000);

*/

function nano(template, data) {
  return template.replace(/\{([\w\.]*)}/g, function (str, key) {
    var keys = key.split("."), value = data[keys.shift()];
    keys.forEach(function (key) { value = value[key] });
    return value;
  });
}

var sys = require("sys"),
    tcp = require("net"),
    url = require("url");

var handshakeTemplate = [
  'GET {path} HTTP/1.1',
  'Upgrade: WebSocket',
  'Connection: Upgrade',
  'Host: {host}',
  'Origin: {origin}',
  '',
  ''].join("\r\n");

var headerExpressions = [
  /^HTTP\/1.1 101 Web Socket Protocol Handshake$/, 
  /^Upgrade: WebSocket$/, 
  /^Connection: Upgrade$/,
  /^WebSocket-Origin: (.+)$/,
  /^WebSocket-Location: ws:(.+)$/];

exports.createClient = function (wsUri, clientOrigin) {
  var uri = url.parse(wsUri);
  uri.port = typeof uri.port !== 'undefined' ? uri.port : 80;
  uri.pathname = typeof uri.pathname !== 'undefined' ? uri.pathname : '/';
  
  if (typeof clientOrigin === 'undefined') {
    clientOrigin = 'http://www.example.com';
  }
  var socket = tcp.createConnection(uri.port, uri.hostname);
  socket.setTimeout(0);
  socket.setNoDelay(true);
  socket.setEncoding('utf8');
  
  var emitter = new process.EventEmitter();
  var handshaked = false;
  var buffer = '';
 
  socket.addListener('connect', function() {
  	var hs = nano(handshakeTemplate, {
      path:     uri.pathname,
      host:     uri.host,
      origin:   clientOrigin,
    });
    socket.write(hs);
  });
 
  socket.addListener('data', function (data) {
    if(handshaked) {
      handle(data);
    } else {
      handshake(data);
    }
  });
 
  socket.addListener('end', function () {
    socket.end();
  });
 
  socket.addListener('end', function () {
    if (handshaked) {
      emitter.emit('end');
    }
  });
 
  function handshake(data) {
  	buffer += data;
  	if (buffer.indexOf('\r\n\r\n') < 0) {
  	  return;
  	}
    var headers = buffer.split('\r\n');

    var matches = [], match;
    for (var i = 0, l = headerExpressions.length; i < l; i++) {
      match = headerExpressions[i].exec(headers[i]);

      if (match) {
        if(match.length > 1) {
          matches.push(match[1]);
        }
      } else {
        socket.end();
        return;
      }
    }
   
    handshaked = true;
    emitter.emit('connect');
    buffer = '';
  }
 
  function handle(data) {
    buffer += data;
   
    var chunks = buffer.split('\ufffd');
    var count = chunks.length - 1; // last is "" or a partial packet
     
    for(var i = 0; i < count; i++) {
      var chunk = chunks[i];
      if(chunk[0] == '\u0000') {
        emitter.emit('data', chunk.slice(1));
      } else {
        socket.end();
        return;
      }
    }
   
    buffer = chunks[count];
  }
 
  emitter.remoteAddress = socket.remoteAddress;
   
  emitter.write = function (data) {
      try {
        socket.write('\u0000', 'binary');
        socket.write(data, 'utf8');
        socket.write('\uffff', 'binary');
      } catch(e) { 
        // Socket not open for writing, 
        // should get "end" event just before.
        socket.end();
      }
  }
   
  emitter.end = function () {
    socket.end();
  }
  
  return emitter;
}