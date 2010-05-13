var ws = require('../ws-client'),
    sys = require('sys');

var client = ws.createClient('ws://localhost:8080/', 'http://localhost');

client.addListener('connect', function() {
  sys.puts("Connected!");
});

client.addListener('data', function(chunk) {
  sys.puts("Received data: " + chunk);
});

client.addListener('end', function() {
  sys.puts("Disconnected!");
});

setTimeout(function() {
  for(var i = 0; i<10; i++) {
    setTimeout(function() {
      client.write("Hello WS world! " + Math.random().toString());
    }, i*200);
  }
}, 2000);

setTimeout(function() {
  client.close();
}, 10000);