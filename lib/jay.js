
var Kaiseki = require('kaiseki')
  , multiparty = require('multiparty')
  , https = require('https')
  , FB = require('fb')
  , jwt = require('jwt-simple')
  , Jimp = require("jimp")
  , sizeOf = require('image-size')
  , fs = require('fs');

var tokens = {}

// CRUD
var Jay = function(){

  var self = this;

  self.get = function(req, res, config, callback){
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
    var kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey);
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

  self.post = function(req, resp, config, callback) {

    var table = getParameterByName("table", req.originalUrl);
    var form = new multiparty.Form();

    // handle the FormData
    form.parse(req, function(err, fields, files) {
      var fields = removeEmptyFields(fields);
      // Create object in Parse
      var kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey);
      kaiseki.createObject(table, fields, function(err, response, body, success) {
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
            saveFiles(table, body.objectId, files, config, callback)
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


  self.put = function(req, res, config, callback) {
    var table = getParameterByName("table", req.originalUrl);
    var id = getParameterByName("id", req.originalUrl);
    var data = getParameterByName("data", req.originalUrl);
    var form = new multiparty.Form();

    // handle the FormData
    form.parse(req, function(err, fields, files) {
      var fields = removeEmptyFields(fields);
      // Create object in Parse
      var kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey);
      kaiseki.updateObject(table, id, fields, function(err, response, body, success) {
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
            saveFiles(table, id, files, config, callback)
          } else {
            // no uploading neccessary
            callback({ objectId: id });
          }
        } else {
          callback({error: err});
        }
      });
    });
  }

  self.query = function (req, res, config, callback){
    var table = getParameterByName( "table", req.originalUrl);
    var limit = getParameterByName( "limit", req.originalUrl);
    var key = getParameterByName( "key", req.originalUrl);
    var value = getParameterByName( "value", req.originalUrl);
    var order = getParameterByName( "order", req.originalUrl);

    table = String(table);
    limit = Number(limit);
    order = String(order);
    key = String(key);
    value = String(value);

    var where = {}
    where[key] = value;

    if(table && limit && key && value) {
      // Prepeare the query
      var params = {
        where: where,
        limit: limit,
        order: order
      }
    } else {
      callback({ error: "Query is missing something" });
    }
    // get the posts from Parse
    var kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey);
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

  self.logIn = function(request, response, config, callback) {
    //console.log(config)
    //console.log(config.app)
    //console.log(config.facebook)
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
        var kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey);
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
                callback({ error: true, message: 'could not create user. Error code:'+body.code+'. Parse.com response: '+body.error});
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

function saveFiles(table, id, files, config, callback) {
  var lastKey = Object.keys(files).length;
  var counter = 1;
  Object.keys(files).forEach(function(key) { // iterate over all files.

    var kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey);
    kaiseki.uploadFile(files[key][0].path, function(err, res, uploadBody, success) {
      if(success) {

        var post = {};
        var fieldname = String(files[key][0].fieldName);
        post[fieldname] = {
          name: uploadBody.name,
          __type: 'File'
        }
        kaiseki.updateObject(table, id, post, function(err, response, uploadBody, success) {
          if (success) {
            if (counter === lastKey) { // if it's the last image on the patch, reply with a callback.
              callback({ objectId: id })
            }
            counter++;

            // if thumbnails are requested, create them
            if(config.thumbnails.enabled === true) {
              var quality = config.thumbnails.quality;
              // create thumbnails
              copyResizeUpload(table, id, config, files[key][0].path, 1200, quality, function(){
                // we are so syncreous
                copyResizeUpload(table, id, config, files[key][0].path, 600, quality, function(){
                  // ow yeah...
                  // Just trying to keep Kaiseki happy
                  copyResizeUpload(table, id, config, files[key][0].path, 300, quality, function(){
                    console.log("all thumbnails done")
                  });
                })
              })
            }
          } else {
            console.log(err);
            console.log(uploadBody)
            callback({ error: "File not uploaded" });
          }
        });
      } else {
        console.log(err);
        callback({ error: err });
      }
    });
  });
}

function copyResizeUpload(table, id, config, file, width, quality, callback) {
  sizeOf(file, function (err, dimensions) { // get image dimensions
    var scale = 1 / (dimensions.width / width);
    var filename = makePsw();
    new Jimp(file, function (err, image) {
      this.scale(scale) // make it smaller
        .quality(quality) // set JPEG quality
        .write(filename + ".jpg", function(){
          // upload it
          var kaiseki = new Kaiseki(config.kaiseki.appId, config.kaiseki.restApiKey);
          kaiseki.uploadFile(filename + ".jpg", function(err, res, uploadBody, success) {
            // delete the created file
            fs.unlinkSync(filename + ".jpg");
            if(success) {
              var post = {};
              var fieldname = String("thumb" + width);
              post[fieldname] = {
                name: uploadBody.name,
                __type: 'File'
              }
              kaiseki.updateObject(table, id, post, function(err, response, uploadBody, success) {
                if (success) {
                  console.log("Post " + id + " thumbnail " + width + " done")
                  callback("Post " + id + " thumbnail " + width + " done")
                } else {
                  console.log("ERROR! Failed to create thubmnail for " + id + " thumbnail " + width)
                  console.log(uploadBody)
                  callback({error: "ERROR! Failed to create thubmnail for " + id + " thumbnail " + width})
                }
              });
            } else {
              console.log(err);
              callback({error: err})
            }
          });
        })
    });
  });
}

function removeEmptyFields(fields) {
  var fields2 = {}
  for(var one in fields) {
    if(String(fields[one]) != "undefined") {
      fields2[one] = String(fields[one]);
    }
  }
  return fields2;
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
