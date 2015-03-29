
var config = require('../../../config')
  , Kaiseki = require('kaiseki')
  , kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey)
  , multiparty = require('multiparty')
  , https = require('https')
  , FB = require('fb')
  , jwt = require('jwt-simple');


var tokens = {}

// CRUD
var Jay = function(){

  var self = this;

  self.get = function(req, res, callback){
    var table = getParameterByName( "table", req.originalUrl);
    var id = getParameterByName( "id", req.originalUrl);
    var limit = getParameterByName( "limit", req.originalUrl);
    limit = Number(limit);

    // Prepeare the query
    if(id != "undefined" && limit === 1) { // objectId is set, this should send only one entry
      var params = {
        where: {
          objectId: id
        },
        limit: limit,
        order: '-createdAt'
      }
    } else if(limit > 1 && id === "undefined") { // objectId is not set, this should be a query for multiple elements
      var params = {
        limit: limit,
        order: '-createdAt'
      }
    } else {
      callback({ error: "Query is confused" });
    }
    // get the posts from Parse
    kaiseki.getObjects(table, params, function(err, response, body, success) {
      if(err) {
        callback({ error: err });
      } else {
        if(body[0]) {
          callback(body);
        } else {
          callback({ error: "No such post" });
        }
      }
    });
  }

  self.post = function(req, resp, callback) {

    var table = getParameterByName("table", req.originalUrl);
    var form = new multiparty.Form();
    // handle the FormData
    var fields2 = {}
    form.parse(req, function(err, fields, files) {
      for(var one in fields) {
        if(String(fields[one]) != "undefined") {
          fields2[one] = String(fields[one]);
        }
      }
      // Create object in Parse
      kaiseki.createObject(table, fields2, function(err, response, body, success) {
          // get first key name
          if(success) {
            var first = null;
            var firstKey = null;
            for (var firstKey in files) {
              first = files[firstKey];
              if(typeof(first) !== 'function') {
                  break;
              }
          }
          // If there's a file, upload it
          if(files[firstKey]) {
            Object.keys(files).forEach(function(key) { // iterate over all files.
              kaiseki.uploadFile(files[key][0].path, function(err, res, uploadBody, success) {
                if(success) {
                  var post = {};
                  var fieldname = String(files[key][0].fieldName);
                  post[fieldname] = {
                    name: uploadBody.name,
                    __type: 'File'
                  }
                  kaiseki.updateObject(table, body.objectId, post, function(err, response, uploadBody, success) {
                    if (success) {
                      callback({ objectId: body.objectId })
                    } else {
                      console.log(err);
                      callback({ error: "File not uploaded" });
                    }
                  });
                } else {
                  console.log(err);
                }
              });
            });
          } else {
            // no uploading neccessary
            callback({ objectId: body.objectId });
          }
        } else {
          callback({error: err});
        }
      });
    });
  }

  /*
  self.put = function(req, res) {
    var table = getParameterByName("table", req.originalUrl);
    var id = getParameterByName("id", req.originalUrl);
    var data = getParameterByName("data", req.originalUrl);
    data = JSON.parse(data);
    kaiseki.updateObject(table, id, data, function(err, response, body, success) {
      if(success) {
        res.json({status: "object updated at: " + body.updatedAt});
        console.log('object updated at = ', body.updatedAt);
      } else {
        console.log(err);
        res.json({error: err});
      }
    });
  }
  */

  self.cl = function(data) {
    console.log(data);
  }

  self.ensureAuthenticated = function(req, res, next){
    var token = getParameterByName("token", req.originalUrl);
    var user = getParameterByName("user", req.originalUrl);
    if(tokens[user] === token) {
      return next();
    } else {
      res.json({error: true, message: "authentication failed"})
    }
  }

  self.logIn = function(request, response, callback) {
    var data = '';
    request.on('data', function(chunk) {
        data += chunk.toString('utf8');
    });

    request.on('end', function() {

      var ajax_object = {};
      try { ajax_object = JSON.parse(data) } catch(err) {
        callback({ error: true, type: 'data', message: 'data could not be parsed'})
      };

      var short_lived_access_token = ajax_object.access_token;
      var type = ajax_object.type;

      if (type == "long") {
        me(short_lived_access_token);
      }

      if (type == "short") {

        var optionsget = {
            host : 'graph.facebook.com',
            port : 443,
            path : '/oauth/access_token?grant_type=fb_exchange_token&client_id=' + config.facebook.clientId + '&client_secret=' + config.facebook.clientSecret + '&redirect_uri=http://'+ config.app.host +'/&fb_exchange_token=' + short_lived_access_token,
            method : 'GET' // do GET
          };

         var reqGet = https.request(optionsget, function(res) {
          if (res.statusCode != 200) {
            callback({ error: true, type: 'data', message: 'res.statusCode != 200'});
          };

          res.on('data', function(d) {
            var decoded_data = d.toString('utf8');
            var access_string = decoded_data;
            try {
              var a = access_string.split('access_token')[1]
              var b = a.split('&expires')[0]
              long_lived_access_token = b.split('=')[1];
              me(long_lived_access_token);
            } catch (err) {
              callback({ error: true, type: 'data', message: 'oAuth fails'});
            };
          });
        });

        reqGet.end();
        reqGet.on('error', function(e) {
          console.error(e);
        });
      }
    });

    function me(long_lived_access_token) {

      FB.api('me', { fields: ['id', 'name', 'verified', 'link', 'email'], access_token: long_lived_access_token}, function (res) {

        console.log(res.name);

        if (res.id === undefined) {
            callback({ error: true, message: 'could not get res.id'});
        }

        if (res.name === undefined) {
            callback({ error: true, message: 'could not get res.first_name'});
        }

        if (res.email === undefined) {
            res.email = '';
        }

        // get the posts from Parse
        var params = {
          where: {
            fbId: res.id
          },
          limit: 1
        }

        kaiseki.getObjects("_User", params, function(err, resp, body, success) {
          if(body.length > 0) { //user found
            // jayb also saves hash, but we currently don't
            //user_db.hash = long_lived_access_token;
            //user_db.save();
            return_payload();
          } else { // user not found

            var password = makePsw(); // since Parse.com won't accept new users without passwords
            var userInfo = {
              username: res.name,
              password: password,
              link: res.link,
              verified: res.verified,
              fbId: res.id,
              name: res.name,
              email: res.email
            };

            kaiseki.createUser(userInfo, function(err, res, body, success) {
              if(success) {
                return_payload();
              } else {
                callback({ error: true, message: 'could not create user'});
              }
            });
          }

          function return_payload() {

            var payload = {};
            payload.id = res.id;
            payload.username = res.name;
            payload.email = res.email;
            var secret = config.jwtSimple.secret;
            var token = jwt.encode(payload, secret);
            tokens[res.id] = token;

            callback({ error: false, message: 'authenticated', token: token, id: res.id });
          }
        });
      });
    }
  }
}

// Extract parameters from REST API calls
// from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
function getParameterByName(name, url) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
  results = regex.exec(url);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function makePsw() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for( var i=0; i < 16; i++ ) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

module.exports = new Jay();
