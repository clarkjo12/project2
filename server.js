// Dependencies
//app.use('/static', express.static(__dirname + '/static'));

require("dotenv").config();
var express = require("express");
var exphbs = require("express-handlebars");
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

var db = require("./models");

var app = express();
var server = http.Server(app);
var io = socketIO(server);
var PORT = process.env.PORT || 3000;

var playerCount = 0;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("public"));

// Handlebars
app.engine(
  "handlebars",
  exphbs({
    defaultLayout: "main"
  })
);
app.set("view engine", "handlebars");

// Routes
require("./routes/apiRoutes")(app);
require("./routes/htmlRoutes")(app);

var syncOptions = { force: false };

// If running a test, set syncOptions.force to true
// clearing the `testdb`
if (process.env.NODE_ENV === "test") {
  syncOptions.force = true;
}

// Starting the server, syncing our models ------------------------------------/
db.sequelize.sync(syncOptions).then(function () {
  server.listen(PORT, function () {
    console.log(
      "==> 🌎  Listening on port %s. Visit http://localhost:%s/ in your browser.",
      PORT,
      PORT
    );
  });
});

var playerTurn = "wait";
var playerLetter = "O";
var players = {};
var playerNames = [];
var gameboard = ["", "", "", "", "", "", "", "", ""];
io.on('connection', function (socket) {
  socket.on('new player', function (userName) {
    playerCount = io.engine.clientsCount;
    console.log("There are " + playerCount + " players logged in.");
    playerNames[playerCount - 1] = userName;
    if (playerCount === 1) {
      playerState = "turn";
      playerLetter = "X";
    }
    else {
      playerState = "wait";
      playerLetter = "O";
    }
    players[socket.id] = {
      name: userName,
      count: playerCount,
      state: playerState,
      letter: playerLetter
    };
    socket.emit('player assignments', players[socket.id])
    if (playerCount === 2) {
      io.emit('game begins', playerNames);
    }
    if (playerCount > 2) {
      socket.emit('game in play', gameboard);
    }
  });
  socket.on('movement', function (data) {
    gameboard = data;
    io.emit('state', data);
  });
  socket.on('disconnect', function (data) {
    var index = players[socket.id].count - 1;
    playerNames.splice(index,1);
    if (playerCount != 0) {
      playerCount = io.engine.clientsCount;
    }
    console.log('user disconnected.  count is ' + playerCount);
    io.emit('disconnect', playerCount);
    if ((playerCount === 2) && (index < 2)) {
      io.emit('game begins', playerNames);
    }
  });
});

module.exports = app;
