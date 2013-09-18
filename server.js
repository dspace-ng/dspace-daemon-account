var Faye = require('faye');
var cradle = require('cradle');
var nconf = require('nconf');

/*
 * get config from file
 */
nconf.file({ file: 'config.json' });

if(nconf.get('couchdb').database !== "") {
  var persisting = true;
  console.log('saving data to CouchDB: ' + nconf.get('couchdb').database);
  var options = {};
  if(nconf.get('couchdb').password !== ""){
    options = {auth: {username: nconf.get('couchdb').username, password: nconf.get('couchdb').password}};
  }
  var db = new(cradle.Connection)(nconf.get('couchdb').ip,
                                  nconf.get('couchdb').port,
                                  options).database(nconf.get('couchdb').database);
}

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

      // if it has UUID just save it using original one
      if(message.data.uuid) {
        db.save(message.data.uuid, message, function(err, res){
          if(err) console.log(err);
        });
      } else {
        db.save(message, function(err, res){
          if(err) console.log(err);
        });
      }
    }

    // call the server back
    callback(message);
  }
};

var bayeux = new Faye.NodeAdapter({mount: '/faye'});
if(persisting) bayeux.addExtension(persistData);

var port = nconf.get('faye').port;
bayeux.listen(port);
console.log('listening on ' + port);
