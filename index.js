var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var app = express();

const port = process.env.PORT || 8888;

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

// credentials are optional

var client_id = '<>'; // Your client id
var client_secret = '<>'; // Your secret
var redirect_uri = '<>'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  
  // your application requests authorization
  var scope = 'playlist-modify-public user-library-read user-read-private user-read-email playlist-read-private playlist-read-collaborative';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
      }));
  });

  app.get('/callback', function(req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter
  
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;
  
    if (state === null || state !== storedState) {
      res.redirect('/#' +
        querystring.stringify({
          error: 'state_mismatch'
        }));
    } else {
      res.clearCookie(stateKey);
      var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
          code: code,
          redirect_uri: redirect_uri,
          grant_type: 'authorization_code'
        },
        headers: {
          'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
        },
        json: true
      };
  
      request.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
  
          var access_token = body.access_token,
              refresh_token = body.refresh_token;
          //Access account info
          var options = {
            url: 'https://api.spotify.com/v1/me',
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
          };
          
          //access liked songs
          request.get(options, function(error, response, body) {
            if(response){
              request.post({
                url: 'https://api.spotify.com/v1/users/'+body.id+'/playlists',
                headers: {  
                            'Authorization': 'Bearer ' + access_token,
                            'Content-Type' : 'application/json'},
                body:{
                  "name": "Disco Refresh"
                },
                json: true
                
              },
                function (error, response, body) {
                  var playlist = body.id;
                  playlistData = body
                  request.get({
                    url: 'https://api.spotify.com/v1/users/me/tracks',
                    headers: { 'Authorization': 'Bearer ' + access_token }
                  },
                    function (error, response, body) {
                      var playlists = JSON.parse(body);
                      var recommendedTracks = [];
                      for(i = 0; i<=playlists.items.length-1; i++){
                        var trackID = playlists.items[i].track.id;
                        var artistID = playlists.items[i].track.artists[0].id
                        //get recommendations
                        request.get({
                          url: 'https://api.spotify.com/v1/recommendations?seed_artists='+artistID+'&seed_tracks='+trackID,
                          headers: { 'Authorization': 'Bearer ' + access_token }
                        },
                          function (error, response, body){
                            var recommendedTrack = JSON.parse(body);
                            recommendedTracks.push(recommendedTrack.tracks[0].uri);
                            console.log(recommendedTrack.tracks[0].uri);
                             request.post({
                              url: 'https://api.spotify.com/v1/playlists/'+playlist+'/tracks',
                              headers: {  
                                          'Authorization': 'Bearer ' + access_token,
                                          'Content-Type' : 'application/json'},
                              body:{
                                "uris": [recommendedTrack.tracks[0].uri]
                              },
                              json: true
                              
                            }, function(error, response, body){
                              if(error){
                                console.log(error);
                              }
                              if(response){
                                console.log("inserted");
                              }
                            }
                          )
                          }) 
                      }
                    }
                  )
                  //res.json(playlistData);
                }
              )
              
            }
            
          });
  
          
          res.redirect('/#done');
        } else {
          res.redirect('/#' +
            querystring.stringify({
              error: 'invalid_token'
            }));
        }
      });
    }
  });
  app.get('/refresh_token', function(req, res) {

    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
      form: {
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      },
      json: true
    };
  
    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token;
        res.send({
          'access_token': access_token
        });
      }
    });
  });
