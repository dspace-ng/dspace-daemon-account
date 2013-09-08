var Faye = require('faye');
var cradle = require('cradle');
var http = require('http');
var persona = require('./persona');
var crypto = require('crypto');
var uuid = require('node-uuid');
var fs = require('fs');
var nconf = require('nconf');

/*
 * get config from file
 */
nconf.file({ file: 'config.json' });

if(nconf.get('couchdb').database !== "") {
  var persisting = true;
  console.log('saving data to CouchDB: ' + nconf.get('couchdb').database);
  var db = new(cradle.Connection)(nconf.get('couchdb').ip,
                                  nconf.get('couchdb').port,
                                  {auth: {username: nconf.get('couchdb').username, 
                                    password: nconf.get('couchdb').password}}
                                 ).database(nconf.get('couchdb'));
}

var savedState = {};

var notMeta = function(message){
  return !message.channel.match(/^\/meta\/.*/);
};

var isSubscription = function(message){
  return message.channel == '/meta/subscribe';
};
/*
 * Extension to persist data
 * http://faye.jcoglan.com/node/extensions.html
 */
var persistData = {
  incoming: function(message, callback){

    // ignore meta messages
    if(notMeta(message)){

      // persist message
      message.ext = {};
      message.ext.saved_at = new Date().getTime();
      db.save(message, function(err, res){
        if(err) console.log(err);
      });
    }

    // call the server back
    callback(message);
  }
};

var tokens = nconf.get('auth').tokens;
var users = nconf.get('auth').users;

var authentication = {
  incoming : function(message, callback){
    //handiling subscriptions
    if(isSubscription(message)){
      var msgSubscription = message.subscription;
      var msgToken = message.ext && message.ext.token;
      var subscriptions = tokens[msgToken];
      if( ! subscriptions ||  subscriptions.indexOf(msgSubscription) == -1 )  {
        message.error = "not allowed to subscribe to this channel";
        console.log('rejected : ', message);
      }
    }
    callback(message);
  }
  //no outgoing messages needs to be handled I assume when you can't subscribe, it will never send anything
  // but maybe we have to prevent faye to propagate to channels of higher levels let's see
  // outgoing : function(message, callback){

  // }
};

var rememberState = {
  incoming: function(message, callback) {
    if(notMeta(message)) {
      if(! savedState[message.channel]) 
        savedState[message.channel] = {};
      savedState[message.channel][message.nickname] = message;
    }
    callback(message);
  },

  outgoing: function(message, callback) {
    if(isSubscription(message) && message.successful) {
      if(! message.ext) message.ext = {};
      if(message.subscription in savedState) {
        var channelState = savedState[message.subscription];
        message.ext.initialState = Object.keys(channelState).map(function(nickname) {
          return channelState[nickname];
        });
      } else {
        message.ext.initialState = [];
      }
    }
    callback(message);
  }
};

var bayeux = new Faye.NodeAdapter({mount: '/faye'});
if(persisting) bayeux.addExtension(persistData);
bayeux.addExtension(rememberState);
bayeux.addExtension(authentication);

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Origin, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Type, Content-Length'
};


function generateToken(cb) {
  crypto.randomBytes(32, function(err, buf) {
    if(err)
      cb(err);
    else 
      cb(undefined, buf.toString('base64'));
  });
}


var server = http.createServer(function(request, response) {
  
  function sendJSON(data){
    var headers = {
      'Content-Type': 'application/json'
    };
    for(var key in CORS_HEADERS) {
      headers[key] = CORS_HEADERS[key];
    }
    response.writeHead(200, headers);
    response.write( JSON.stringify(data) );
    response.end();

  }

  function anonymousAuth(){
    generateToken(function(err, token){
      if(err) {
        console.log("authorization of unidentified user failed : ", err);
        response.writeHead(500, CORSE_HEADERS);
        response.write(err);
        response.end();
      } else {
        var id = uuid.v4();
        tokens[token] = ['/dspace/'+id ];
        sendJSON( {
          token:token, 
          id:id 
        } );
      }
    });
  }

  console.log('REQUEST', request.method, request.url);
  switch(request.method) {
  case 'OPTIONS':
    response.writeHead(204, CORS_HEADERS);
    response.end();
    break;
  case 'POST':
    if(request.url == '/auth')
      persona.auth(request, function(error, persona_response){
        if(error) {
          if(error.reason == "nopersona" )
            anonymousAuth();
          else {
            console.error("Persona Failed : ", error.message);
            response.writeHead(401, CORS_HEADERS);
            response.write(error);
            response.end();
          }
        } else {
          var id = persona_response;
          //console.log("Here we are Now, Authenticated");
          if( users[id] )
            generateToken(function(err, token) {
              if(err) {
                response.writeHead(500, CORS_HEADERS);
                response.write(err);
                response.end();
              } else {
                var scope = users[id];
                if(!scope){
                  scope = ['/dspace']; //FIXME default scope schould be like ['/dspace/'+id, dspace/public'] or something
                  users[id] = scope;
                }
                tokens[token] = scope;
                sendJSON({
                  token:token, 
                  id:id
                });
              }
            });
        }
      });
    break;
  }
});


bayeux.attach(server);
var port = nconf.get('faye').port;
server.listen(port, function() {
  console.log('listening on ' + port);
});
