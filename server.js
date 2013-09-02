var Faye = require('faye');
var cradle = require('cradle');
var http = require('http')
var persona = require('./persona');
// var db = new(cradle.Connection)(process.env.COUCH_IP,
//                                 process.env.COUCH_PORT,
//                                 {auth: {username: process.env.COUCH_USERNAME, 
//                                         password: process.env.COUCH_PASSWORD}}
//                                ).database('dspace-elevate')

var savedState = {};

/*
 * Extension to persist data
 * http://faye.jcoglan.com/node/extensions.html
 */
var persistData = {
  incoming: function(message, callback){

    // ignore meta messages
    if(message.channel.match(/\/meta\/*/)){
      return callback(message);
    };

    // persist message
    message.ext = {};
    message.ext.saved_at = new Date().getTime();
    db.save(message, function(err, res){
      if(err) console.log(err);
    });

    // call the server back
    callback(message);
  }
};

var rememberState = {
  incoming: function(message, callback) {
    if(! message.channel.match(/^\/meta\//)) {
      if(! savedState[message.channel]) savedState[message.channel] = {};
      savedState[message.channel][message.nickname] = message;
    }
    callback(message);
  },

  outgoing: function(message, callback) {
    if(message.channel == '/meta/subscribe' && message.successful) {
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
}

var bayeux = new Faye.NodeAdapter({mount: '/dspace'});
//bayeux.addExtension(persistData);
bayeux.addExtension(rememberState);

var server = http.createServer(function(request, response) {
  console.log('REQUEST', request.method, request.url);
  switch(request.method) {
  case 'OPTIONS':
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Origin, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Type, Content-Length'
    });
    response.end();
    break;
  case 'POST':
    if(request.url == '/auth')
      persona.auth(request, response, function(error, persona_response){
        if(error) {
          console.error("Persona Failed : ", error.message)
        } else {
          console.log("Here we are Now, Authenticated")
        }
      });
    break;
  }
});

bayeux.attach(server);
server.listen(5000, function() {
  console.log('listening on 5000');
});
