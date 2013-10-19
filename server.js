var nconf = require('nconf');
var http = require('http');
var express = require('express');
var cors = require('cors');
var Faye = require('faye');
var levelup = require('level');

/*
 * get config from file
 */
nconf.file({ file: 'config.json' });

var db = levelup(nconf.get('db').location, { keyEncoding: 'json', valueEncoding: 'json' });

/*
 * data
 */
var players = {};
db.get('players', { asBuffer: false }, function(err, data){
  if(err) console.log(err);
  if(data){
    players = data;
  }
}.bind(this));

var updatePlayers = function(player){
  players[player.uuid] = player;
  db.put('players', players, function(err){ console.log(err); });
};

var tracks = {};
db.get('tracks', { asBuffer: false }, function(err, data){
  if(err) console.log(err);
  if(data){
    tracks = data;
  }
}.bind(this));

var updateTrack = function(uuid, position){
  if(!tracks[uuid]) tracks[uuid] = [];
  tracks[uuid].push(position);
  db.put('tracks', tracks, function(err){ console.log(err); });
  db.put('tracks/' + uuid, tracks[uuid], function(err){ console.log(err); });
};

/*
 * Faye
 */

var notMeta = function(message){
  return !message.channel.match(/^\/meta\/.*/);
};

var storeMessages = {
  incoming: function(message, callback){
    if(notMeta(message)){

      if(nconf.get('debug')) console.log(message);

      //if(message.channel.match(/players/)){
        //updatePlayers(message.data);
      //} else if(message.channel.match(/positions/)){
        //var uuid = message.channel.replace('/positions/', '');
        //updateTrack(uuid, message.data);
      //}
    }
    callback(message);
  }
};

var bayeux = new Faye.NodeAdapter({mount: '/faye'});
bayeux.addExtension(storeMessages);

/*
 * Express
 */

var app = express();

app.get('/players', function(req, res) {
  db.get('players', { asBuffer: false }, function(err, data){
    if(err) console.log(err);
    if(data){
      res.json(data);
    }
    res.send(200);
  }.bind(this));
});

app.get('/tracks', function(req, res) {
  db.get('tracks', { asBuffer: false }, function(err, data){
    if(err) console.log(err);
    if(data){
      res.json(data);
    }
    res.send(200);
  }.bind(this));
});

app.get('/tracks/:uuid', function(req, res) {
  db.get('tracks/' + req.params.uuid, { asBuffer: false }, function(err, data){
    if(err) console.log(err);
    if(data){
      res.json(data);
    }
    res.send(200);
  }.bind(this));
});

/*
 * Express + Faye
 */
var server = http.createServer(app);
bayeux.attach(server);

var port = nconf.get('faye').port;
server.listen(port);

console.log('port: ', port);
console.log('db: ', db.location);
