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
var channels = {};

var loadChannel = function(path){
  db.get(path, { asBuffer: false }, function(err, data){
    if(err) console.log(err);
    if(data){
      channels[path] = data;
    }
  }.bind(this));
};

var saveMessage = function(path, message){
  channels[path].push(message);
  db.put(path, channels[path], function(err){ console.log(err); });
};

var saveListing = function(){
  db.put('channels_list', _.keys(channels), function(err){console.log(err); });
};

// initially load listing
// prefent crating channel '/listing' !
db.get('channels_list', {asBuffer: false }, function(err, data){
  if(err) console.log(err);
  if(data){
  data.forEach(function(path){
      loadChannel(path);
    });
  }
});

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

      var path = message.channel;
      if(!channels[path]){
        channels[path] = [];
        saveListing();
      }
      saveMessage(path, message.data);
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

app.get('*', function(req, res) {
  var history = channels[req.params[0]] ? channels[req.params[0]] :  [];
  res.json(history);
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
