JAY-NPM
===================

Server for Single Page App relying on [Jay](https://github.com/jayJs/jay).  
Use [Node-Jay](https://github.com/jayJs/node-jay) as sample of usage.  

**Instant back-end**  
Database via Kaiseki and Parse.com.
Authentication based on FB SDK and jwt-simle tokens.  

**INSTALLATION**  
(Assuming you have npm installed)  
```
npm install jay-npm  
```
Copy (default_config.js)[https://github.com/jayJs/node-jay/blob/master/default_config.js] to config.js in your root foler and fill it with correct credidentials.  
In order for everything to work properly Facebook app and parse.com credidentials are required.  
Set config.jwtSimple.secret into a string of your own choice.  

**USAGE**  
Jay front end component calls "/api/j" for GET and POST calls.  
Jay-npm helps to respond to these calls. This is an example of receiving and replying with an Express server.

```
var Jay = require('jay-npm');

app.get('/api/j', function(req, res){
  Jay.get(req, res, function(data){
    res.json(data);
  });
});
```  
Please note that for this sample also express needs to be installed.  
Check out [Node-Jay](https://github.com/jayJs/node-jay/blob/master/app.js) for a complete example.  

**API**  
**FB SDK Authentication**  
Facebook SDK is added and used for authentication.  
Greetings for [AndrusAsumets](https://github.com/AndrusAsumets) for help with this.

**ensureAuthenticated**  
Compares users token with server token. If match is found the functions is fired, else error message is returned with response.  
```
app.post('/api/j', Jay.ensureAuthenticated, function(req, res){
  Jay.post(req, res, function(data){
    res.json(data);
  })
});
```
**get**  
Retrieves data from Parse.com and returns as object.  
```
Jay.get(req, res, function(data){
  res.json(data);
});
```
**post**  
Parses your formdata and saves it to Parse.com.
If files are added, they are separately uploaded to Parse and added to the object.  
Returns ObjectId.  
```
app.post('/api/j', Jay.ensureAuthenticated, function(req, res){
  Jay.post(req, res, function(data){
    res.json(data);
  })
});
```

**Licence**  

The MIT License (MIT)  

Copyright (c) 2015 Martin Sookael  

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:  

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.  

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.  
