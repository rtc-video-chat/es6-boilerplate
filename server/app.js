const app = require('koa')();
const server = require('http').createServer(app.callback());
const io = require('socket.io')(server);

io.on('connection', function(socket) {

  socket.on('message', function(message) {
    socket.broadcast.emit('message', message);
  });
});

app.use(require('koa-static')('./', {}));

server.listen(3000);