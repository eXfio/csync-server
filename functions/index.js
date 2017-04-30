'use strict';

var crypto    = require('crypto');
var base32    = require('thirty-two');

var functions = require('firebase-functions');
var admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

var base32Table  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
var zBase32Table = "ybndrfg8ejkmcpqxot1uwisza345h769";

function zBase32Encode(buffer, len) {

  var base32Encoded = base32.encode(buffer).toString();

  if ( len ) {
    if ( (buffer.length * 8) < (len * 5) ) {
      //byte buffer too short
      return new Error("Input buffer length less than base32 length");
    }

    base32Encoded = base32Encoded.substring(0, len);
  }

  var zBase32Encoded = "";
  for (var i = 0; i < base32Encoded.length; i++) {
    var pos = base32Table.indexOf(base32Encoded[i]);
    //console.log("Transposing pos: " + i + ", val: " + pos + ", base32: " + base32Table.charAt(pos) + ", z-Base32: " + zBase32Table.charAt(pos));
    if ( pos >= 0 ) {
      zBase32Encoded += zBase32Table.charAt(pos);
    } else if ( base32Encoded[i] == '=' ) {
      //ignore padding characters
      break;
    } else {
      return new Error("Unknown char '" + encoded[i] + "'");
    }
  }
  return zBase32Encoded;
}

function zBase32Decode(zBase32Encoded) {
  var base32Encoded = "";
  for (var i = 0; i < zBase32Encoded.length; i++) {
    var pos = zBase32Table.indexOf(zBase32Encoded[i]);
    if ( pos >= 0 ) {
      base32Encoded += base32Table.charAt(pos);
    } else {
      return new Error("Unknown char '" + encoded[i] + "'");
    }
  }
  return base32.decode(base32Encoded);
}

/**
 * processPostInit
 *
 * {
 *   clientid:   "id of receiver",
 *   name:       "name of receiver",
 *   key:        "receiver's identity key",
 *   ekey:       "receiver's ephemeral key digest"
 * }
 *
 */
function processPostInit(request, response) {
  console.log("processPostInit()");

  //TODO - verify request body, e.g. using JST

  var requestMessage = request.body;

  console.log("request message:");
  console.dir(requestMessage);

  //generate random 20 bit token

  /*
  //1 generate random 3 bytes (24 bits)
  var seed = crypto.randomBytes(3);
  console.log("seed (24bit): " + seed.toString('hex'));

  //2 mask 20 bits
  var maskValue = Math.pow(2, 20) - 1;

  //DEBUG - confirm mask value
  //var mask = Buffer.alloc(3, Math.pow(2, 20) - 1);
  var mask = new Buffer(3);
  mask.writeUIntLE(maskValue, 0, 3);
  console.log("mask (24bit): " + mask.toString('hex'));

  var tokenValue = seed.readUIntLE(0, 3) & maskValue;
  //var token = Buffer.alloc(3, tokenValue);
  var token = new Buffer(3);
  token.writeUIntLE(tokenValue, 0, 3);
  console.log("token (20bit): " + token.toString('hex'));

  //3 encode using z-base32
  var tokenZBase32 = zBase32Encode(token, 4);
  console.log("token (z-Base32): " + tokenZBase32);
  */

  //1 generate random 3 bytes (24 bits)
  var token = crypto.randomBytes(3);
  //console.log("seed (24bit): " + token.toString('hex'));

  //2 encode using z-base32 and truncate to 4 chars (20 bits)
  var tokenZBase32 = zBase32Encode(token, 4);
  console.log("token (z-Base32): " + tokenZBase32);

  //FIXME - check for collisions

  var zaSession = {
      createdAt: admin.database.ServerValue.TIMESTAMP,
      modifiedAt: admin.database.ServerValue.TIMESTAMP,
      token: tokenZBase32,
      state: 'init',
      messages: {
        init: requestMessage
      }
  };

  var zaRef = admin.database().ref('/zeroauth');
  zaRef.child(tokenZBase32).set(zaSession)
    .then(function() {
      var responseMessage = {
        token: tokenZBase32
      };
      response.send(responseMessage);
    },
    function(error) {
      var errormsg = "Couldn't get zero auth init message - " + error;
      console.error(errormsg);
      response.status(500).send(errormsg);
    });
}

function processGetInit(request, response, token) {
  //TODO - verify request, e.g. using JST

  var zaRef = admin.database().ref('/zeroauth');
  zaRef.child(token + '/messages/init').once('value')
    .then(function(snapshot) {
      var responseMessage = snapshot.val();
      response.send(responseMessage);
    },
    function(error) {
      var errormsg = "Couldn't get zero auth init message - " + error;
      console.error(errormsg);
      response.status(500).send(errormsg);
    });

}

function processPostVerifyRequest(request, response, token) {

}

function processGetVerifyRequest(request, response, token) {

}

function processPostVerifyResponse(request, response, token) {

}

function processGetVerifyResponse(request, response, token) {

}

exports.zeroauth = functions.https.onRequest((request,  response) => {

  var method = request.method;
  var token = null;
  var action = null;

  var matches = null;

  if ( request.path === null ) {
    if ( method == 'POST' ) {
      action = "init";
    } else {
      var errormsg = "POST method required for init action";
      console.error(errormsg);
      response.status(500).send(errormsg);
    }
  } else if ( matches = request.path.match(/^\/([^/]+)\/(.+)$/) ) {
      token = matches[1];
      action = matches[2];
  } else {
    var errormsg = "Token and action required";
    console.error(errormsg);
    response.status(500).send(errormsg);
  }

  //Handle request based on method, action and token

  if ( method == 'POST' && action == 'init' ) {
    processPostInit(request, response);
  } else if ( method = 'GET' && action == 'init' ) {
    processGetInit(request, response, token);
  } else if ( method = 'POST' && action == 'verifyrequest' ) {
    processPostVerifyRequest(request, response, token);
  } else if ( method = 'GET' && action == 'verifyrequest' ) {
    processGetVerifyRequest(request, response, token);
  } else if ( method = 'POST' && action == 'verifyresponse' ) {
    processPostVerifyResponse(request, response, token);
  } else if ( method = 'GET' && action == 'verifyresponse' ) {
    processGetVerifyResponse(request, response, token);
  } else {
    var errormsg = "Request not supported - method: " + method + ", token: " + token + ", action: " + action;
    console.error(errormsg);
    response.status(500).send(errormsg);
  }

});
