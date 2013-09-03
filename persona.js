var https = require('https');
var qs = require('querystring');

var audience = "http://localhost:3000";
// var exports = {}
exports.auth = function(req, callback){
  // parsing the post data
  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });
  req.on('end', function(){
    var data = qs.parse(body);
    req.body = data
    var assertion =  data['assertion'];
    // we have an assertion thingi
    if(assertion){ 
      auth(assertion, callback);
    } else {
      var e = new Error("no assertion found : '"+str+"'" )
      e.reason = 'nopersona'
      callback(e);
    }
  });
}

function auth(assertion, callback){
  //taliking to the persona server
  var body = "audience="+encodeURIComponent(audience)+"&assertion="+assertion
  var request = https.request({
    host: 'verifier.login.persona.org',
    path: '/verify',
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': body.length
    }
  }, function (bidRes) {
      var data = "";
      bidRes.setEncoding('utf8');
      bidRes.on('data', function (chunk) {
        data += chunk;
      });
      bidRes.on('end', function () {
        var verified = JSON.parse(data);
        if (verified.status == 'okay') {
//          console.info('browserid auth successful : ', verified.email);
          callback(undefined,verified);
        } else {
//          console.error(verified.reason);
          callback(new Error(verified.reason), undefined);
        }
      });
  })
  request.write(body);
  request.end();
}

exports.logout = function (req, resp) {
//  maybe we want to logout sometimes;
};
