var nconf = require('nconf');
var _ = require('lodash');
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
var roster = [];
var tracks = {};

var loadedTrack = function(err, data){
  if(err) console.log(err);
  if(data){
    tracks[this.uuid] = data;
  }
};

var loadTracks = function(){
  Object.keys(roster).forEach(function(uuid){
    this.uuid = uuid;
    db.get('/' + uuid + '/track', { asBuffer: false }, loadedTrack.bind(this));
  });
};

var updateTrack = function(uuid, position){
  if(!tracks[uuid]) tracks[uuid] = [];
  tracks[uuid].push(position);
  db.put('/' + uuid + '/track', tracks[uuid], function(err){ console.log(err); });
};


db.get('/roster', { asBuffer: false }, function(err, data){
  if(err) console.log(err);
  if(data){
    roster = data;
    loadTracks();
  }
}.bind(this));

var updateRoster = function(player){
  var index = _.findIndex(roster, function(pl){ return pl.uuid === player.uuid; });
  console.log(index);
  if(index >= 0){
    roster[index] = player;
  } else {
    roster.push(player);
  }
  db.put('/roster', roster, function(err){ console.log(err); });
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

      if(message.channel.match(/roster/)){
        updateRoster(message.data);
      } else if(message.channel.match(/track/)){
        var uuid = message.channel.split('/')[1];
        updateTrack(uuid, message.data);
      }
    }
    callback(message);
  }
};

var bayeux = new Faye.NodeAdapter({mount: '/bayeux'});
bayeux.addExtension(storeMessages);

/*
 * Express
 */

var app = express();
app.use(cors());

app.get('/roster', function(req, res) {
  db.get('/roster', { asBuffer: false }, function(err, data){
    if(err){
      console.log(err);
      res.send(500);
    }
    if(data){
      res.json(data);
    }
  }.bind(this));
});

app.get('/:uuid/track', function(req, res) {
  db.get('/' + req.params.uuid + '/track' , { asBuffer: false }, function(err, data){
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

var port = nconf.get('bayeux').port;
server.listen(port);

console.log('port: ', port);
console.log('db: ', db.location);
