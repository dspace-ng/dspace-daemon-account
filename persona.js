var https = require('https');
//var exports = {}
var cb;
exports.auth = function(req, resp, callback){
  cb = callback;
  //parsing the post data
  str = '';
  req.on('data', function(chunk) {
    str += chunk;
  });
  req.on('end', function(){
    var data = {}
    str.split('&').forEach(function(keyval){
      var pair = keyval.split('=');
      if(pair.length == 2){
        data[pair[0]]=pair[1];
      }else{
//        console.error("PARSING ERROR :",keyval)
        cb(new Error("parsing error '"+keyval+"'"))
        resp.writeHead('403')
        resp.end();
      }
    })

    var assertion =  data['assertion'];
    //we have an assertion thingi
    if(assertion){ 
      auth(assertion, resp);
    } else {
      cb(new Error("no assertion found : '"+str+"'" ))
      resp.writeHead(403,{})
      resp.end();
      
    }
  })
}

function auth(assertion, resp){
  //taliking to the persona server
  var body = "audience="+encodeURIComponent("http://localhost:3000")+"&assertion="+assertion
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
          resp.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Content-Type' : 'application/json',
          })
          cb(undefined,verified);
        } else {
//          console.error(verified.reason);
          cb(new Error(verified.reason), undefined);
          resp.writeHead(403);
        }
        resp.write(data);
        resp.end();
      });
  })
  request.write(body);
  request.end();
}

exports.logout = function (req, resp) {
//  maybe we want to logout sometimes;
};
