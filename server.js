var Faye = require('faye');
var cradle = require('cradle');

var db = new(cradle.Connection)().database('dspace-elevate');

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
}

var bayeux = new Faye.NodeAdapter({mount: '/dspace'});
bayeux.addExtension(persistData);
bayeux.listen(5000);
