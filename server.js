var Faye = require('faye');
var cradle = require('cradle');

var db = new(cradle.Connection)(process.env.COUCH_IP,
                                process.env.COUCH_PORT,
                                {auth: {username: process.env.COUCH_USERNAME, 
                                        password: process.env.COUCH_PASSWORD}}
                               ).database('dspace-elevate')

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
      savedState[message.channel][message.clientId] = message;
    }
    callback(message);
  },

  outgoing: function(message, callback) {
    if(message.channel == '/meta/subscribe' && message.successful) {
      if(! message.ext) message.ext = {};
      if(message.subscription in savedState) {
        var channelState = savedState[message.subscription];
        message.ext.initialState = Object.keys(channelState).map(function(clientId) {
          return channelState[clientId];
        });
      } else {
        message.ext.initialState = [];
      }
    }
    callback(message);
  }
}

var bayeux = new Faye.NodeAdapter({mount: '/dspace'});
bayeux.addExtension(persistData);
bayeux.addExtension(rememberState);
bayeux.listen(5000);
