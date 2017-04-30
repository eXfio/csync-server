'use strict';

// Chai is a commonly used library for creating unit test suites. It is easily extended with plugins.
const chai = require('chai');
const assert = chai.assert;

// Chai As Promised extends Chai so that a test function can be asynchronous with promises instead
// of using callbacks. It is recommended when testing Cloud Functions for Firebase due to its heavy
// use of Promises.
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

// Sinon is a library used for mocking or verifying function calls in JavaScript.
const sinon = require('sinon');

describe('Cloud Functions', () => {

  var myFunctions, configStub, adminInitStub, functions, admin;

  before(() => {
    // Since index.js makes calls to functions.config and admin.initializeApp at the top of the file,
    // we need to stub both of these functions before requiring index.js. This is because the
    // functions will be executed as a part of the require process.
    // Here we stub admin.initializeApp to be a dummy function that doesn't do anything.
    admin =  require('firebase-admin');
    adminInitStub = sinon.stub(admin, 'initializeApp');

    // Next we stub functions.config(). Normally config values are loaded from Cloud Runtime Config;
    // here we'll just provide some fake values for firebase.databaseURL and firebase.storageBucket
    // so that an error is not thrown during admin.initializeApp's parameter check
    functions = require('firebase-functions');

    configStub = sinon.stub(functions, 'config').returns({
        firebase: {
          databaseURL: "https://cucumber-sync.firebaseio.com",
          storageBucket: "cucumber-sync.appspot.com",
        }
        // You can stub any other config values needed by your functions here, for example:
        // foo: 'bar'
      });

    // Now we can require index.js and save the exports inside a namespace called myFunctions.
    // This includes our cloud functions, which can now be accessed at myFunctions.makeUppercase
    // and myFunctions.addMessage
    myFunctions = require('../index');
  });

  after(() => {
    // Restoring our stubs to the original methods.
    configStub.restore();
    adminInitStub.restore();
  });

  describe('processPostInit', (done) => {

    it('should generate a 20 bit z-base32 encoded token', (done) => {

      const refStub = sinon.stub();
      const refParam = '/zeroauth';

      const childStub = sinon.stub();

      const setStub = sinon.stub();
      const setParam = { clientid: 'foo' };

      // The following 4 lines override the behavior of admin.database().ref('/messages')
      // .push({ original: 'input' }) to return a promise that resolves with { ref: 'new_ref' }.
      // This mimics the behavior of a push to the database, which returns an object containing a
      // ref property representing the URL of the newly pushed item.
      var databaseStub = sinon.stub(admin, 'database')
        .returns({
          ref: refStub,
          ServerValue: {
            TIMESTAMP: {
              ".sv": "timestamp"
            }
          }
        });
      refStub.withArgs(refParam).returns( { child: childStub });
      childStub.returns( { set: setStub } );
      setStub.returns( Promise.resolve());

      // A fake request object
      const req = {
        method: 'POST',
        path: null,
        body: {
          clientid: "foo"
        }
      };

      // A fake response object, with a stubbed redirect function which asserts that it is called
      // with parameters 303, 'new_ref'.
      const res = {
        send: (responseMessage) => {
          //TODO - check for response
          console.log("response message:");
          console.dir(responseMessage);
          done();
        },
        status: (code) => {
          assert.equal(code, 500);
          return this;
        }
      };

      myFunctions.zeroauth(req, res);

      // Restoring admin.database() to the original method
      databaseStub.restore();

    });
  });

  describe('processGetInit', (done) => {

    it('should return init message', (done) => {

      const refStub = sinon.stub();
      const refParam = '/zeroauth';

      const childStub = sinon.stub();

      const onceStub = sinon.stub();

      // The following 4 lines override the behavior of admin.database().ref('/messages')
      // .push({ original: 'input' }) to return a promise that resolves with { ref: 'new_ref' }.
      // This mimics the behavior of a push to the database, which returns an object containing a
      // ref property representing the URL of the newly pushed item.
      var databaseStub = sinon.stub(admin, 'database')
        .returns({
          ref: refStub,
          ServerValue: {
            TIMESTAMP: {
              ".sv": "timestamp"
            }
          }
        });
      refStub.withArgs(refParam).returns( { child: childStub });
      childStub.returns( { once: onceStub } );
      onceStub.returns( Promise.resolve(
        {
          val: function() {
            return { clientid: "foo" };
          }
        }
      ));

      // A fake request object
      const req = {
        method: 'GET',
        path: "/bar/init",
        body: null
      };

      // A fake response object, with a stubbed redirect function which asserts that it is called
      // with parameters 303, 'new_ref'.
      const res = {
        send: (responseMessage) => {
          //TODO - check for response
          console.log("response message:");
          console.dir(responseMessage);
          done();
        },
        status: (code) => {
          assert.equal(code, 500);
          return this;
        }
      };

      myFunctions.zeroauth(req, res);

      // Restoring admin.database() to the original method
      databaseStub.restore();

    });
  });

});

//console.log("testing.js");

//testProcessPostInit();
