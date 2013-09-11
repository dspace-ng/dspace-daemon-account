var Faye = require('faye');
var cradle = require('cradle');
var http = require('http');
var fs = require('fs');
var nconf = require('nconf');
var formidable = require('formidable');
var util = require('util'); // #debug
var static = require('node-static');

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
 * static media files
 */
var mediaPath = process.cwd() + '/upload';
var mediaServer = new static.Server();


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
      console.log(message);

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

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Origin, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Type, Content-Length'
};


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


  function saveAttachement(fields, files) {
    var noteUUID = JSON.parse(fields.meta).noteUUID;
    var destination = mediaPath + '/' +  noteUUID;

    var is = fs.createReadStream(files.file.path);
    var os = fs.createWriteStream(destination);

    is.pipe(os);
    is.on('end',function() {
          fs.unlinkSync(files.file.path);
    });
    //console.log(util.inspect({fields: fields, files: files}));
  }

  console.log('REQUEST', request.method, request.url);
  switch(request.method) {
    case 'GET':
      if(request.url.match('/upload/*')){
      fs.readFile(__dirname + request.url, function (err,data) {
        if (err) {
          response.writeHead(404);
          response.end(JSON.stringify(err));
          return;
        }
        response.writeHead(200);
        response.end(data);
      }
                 );
      }
    break;


    case 'OPTIONS':
      response.writeHead(204, CORS_HEADERS);
    response.end();
    break;
    case 'POST':
      if(request.url == '/upload') {
      var noteUUID;

      var form = new formidable.IncomingForm();
      form.parse(request, function(err, fields, files) {
        response.writeHead(200, CORS_HEADERS);
        response.write('received upload:\n\n');
        response.end(saveAttachement(fields, files));
      });
      return;
    }
    break;
  }

});


bayeux.attach(server);
var port = nconf.get('faye').port;
server.listen(port, function() {
  console.log('listening on ' + port);
});
