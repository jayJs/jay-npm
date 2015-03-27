
var Kaiseki = require('kaiseki')
  , multiparty = require('multiparty')


// demo account for J @ parse.com
var kaiseki_app_id = "6qpUJ9soNnRiLQLYnEU2dnY6z1qS98bZrsdl1Tcr";
var kaiseki_rest_api_key = "PJ8sMJzoIqndboAoYOodJHYUglB65NKgW4Kg56oI";
var kaiseki = new Kaiseki(kaiseki_app_id, kaiseki_rest_api_key);
// usage: https://github.com/shiki/kaiseki

// CRUD

// Extract parameters from REST API calls
// from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
function getParameterByName(name, url) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
  results = regex.exec(url);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

var Jay = function(){

    var self = this;

    self.get = function(req, res){
      var table = getParameterByName( "table", req.originalUrl);
      var id = getParameterByName( "id", req.originalUrl);
      var limit = getParameterByName( "limit", req.originalUrl);

      if(id != "undefined") { // if objectId is defined
        var params = {
          where: {
            objectId: id
          },
          limit: limit,
          order: '-createdAt'
        }
      } else { // objectId not defined, propably are asking for moe then one
        var params = {
          limit: limit,
          order: '-createdAt'
        }
      }

      kaiseki.getObjects(table, params, function(err, response, body, success) {
        if(err) {
          res.json({ error: err });
        } else {
          if(body[0]) {
            res.json(body);
          } else {
            res.json({error: "No such post"});
          }
        }
      });
    }


    self.post = function(req, resp) {

      var table = getParameterByName("table", req.originalUrl);
      var form = new multiparty.Form();

      // we create this in order to connect FormData with Parse
      var fields2 = {}

      form.parse(req, function(err, fields, files) {
        for(var one in fields) {
          if(String(fields[one]) != "undefined") {
            fields2[one] = String(fields[one]);
          }
        }

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
            // if there's a file, upload it
            if(files[firstKey]) {
              // iterate over all files.
              Object.keys(files).forEach(function(key) {
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
                        resp.json({ objectId: body.objectId });
                      } else {
                        resp.json({ error: "File not uploaded" });
                        console.log(err);
                      }
                    });
                  } else {
                    console.log(err);
                  }
                });
              });
            } else {
              // no uploading neccessary
              resp.json({ objectId: body.objectId });
            }
          } else {
            resp.json({error: err});
          }
        });
      });
    }

    self.put = function(req, res) {
      var table = getParameterByName("table", req.originalUrl);
      var id = getParameterByName("id", req.originalUrl);
      var data = getParameterByName("data", req.originalUrl);
      data = JSON.parse(data);
      //console.log(data);
      kaiseki.updateObject(table, id, data, function(err, response, body, success) {
        if(success) {
          res.json({status: "object updated at: " + body.updatedAt});
          console.log('object updated at = ', body.updatedAt);
        } else {
          console.log("error");
          console.log(err);
          console.log(body);
          res.json({error: err});
        }
      });
    }
}


module.exports = new Jay();
