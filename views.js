var cradle = require('cradle');
var nconf = require('nconf');

nconf.file({ file: 'config.json' });

// FIXME duplicated from server.js
if(nconf.get('couchdb').database !== "") {
  var options = {};
  if(nconf.get('couchdb').password !== ""){
    options = {auth: {username: nconf.get('couchdb').username, password: nconf.get('couchdb').password}};
  }
  var db = new(cradle.Connection)(nconf.get('couchdb').ip,
                                  nconf.get('couchdb').port,
                                  options).database(nconf.get('couchdb').database);
}

db.save('_design/notes', {
  byUUID: {
    map: function(doc) {
      if(doc.data["@type"] === 'note')
        emit(doc.data.uuid, doc);
    }
  }
});
