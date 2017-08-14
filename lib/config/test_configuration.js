'use strict';

var f = require('util').format,
    fs = require('fs'),
    path = require('path');

var Configuration = function(options) {
  options = options || {};
  var host = options.host || 'localhost';
  var port = options.port || 27017;
  var db = options.db || 'integration_tests';
  var manager = options.manager;
  var skipStart = typeof options.skipStart === 'boolean' ? options.skipStart : false;
  var skipTermination = typeof options.skipTermination === 'boolean' ? options.skipTermination : false;
  var setName = options.setName || 'rs';

  // Default function
  var defaultTopology = function(self, _mongo) {
    return new _mongo.Server({
      host: self.host,
      port: self.port
    });
  };

  var findMongoCore = function(packagePath) {
    if (fs.existsSync(f('%s/package.json', packagePath))) {
      var obj = JSON.parse(fs.readFileSync(f('%s/package.json', packagePath)));
      if (obj.name && obj.name === 'mongodb-core') {
        return packagePath;
      }

      return findMongoCore(path.dirname(packagePath));
    } else if (packagePath === '/') {
      return false;
    }

    return findMongoCore(path.dirname(packagePath));
  };

  var mongoPath = findMongoCore(path.dirname(module.filename));

  try {
    var mongo = require(mongoPath);
  } catch (err) {
    throw new Error('The test runner bust be able to ');
  }

  // Create a topology function
  var topology = options.topology || defaultTopology;

  this.start = function(callback) {
    var self = this;
    if (skipStart) return callback();

    // Purge the database
    manager.purge()
      .then(function() {
        console.log('[purge the directories]');

        return manager.start();
      })
      .then(function() {
        console.log('[started the topology]');

        // Create an instance
        var server = topology(self, mongo);
        console.log('[get connection to topology]');

        // Set up connect
        server.once('connect', function() {
          console.log('[connected to topology]');

          // Drop the database
          server.command(f('%s.$cmd', self.db), {dropDatabase: 1}, function(err, r) {
            console.log('[dropped database]');
            server.destroy();
            callback();
          });
        });

        // Connect
        console.log('[connecting to topology]');
        server.connect();
      }).catch(function(err) {
        callback(err);
      });
  };

  this.stop = function(callback) {
    if (skipTermination) return callback();
    // Stop the servers
    manager.stop().then(function() {
      callback();
    }).catch(function(err) {
      callback(err);
    });
  };

  this.restart = function(opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {purge: true, kill: true};
    }
    if (skipTermination) return callback();

    // Stop the servers
    manager.restart().then(function() {
      callback();
    }).catch(function(err) {
      callback(err);
    });
  };

  this.setup = function(callback) {
    callback();
  };

  this.teardown = function(callback) {
    callback();
  };

  this.newTopology = function(opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    callback(null, topology(this, mongo));
  };

  this.newConnection = function(opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    var server = topology(this, mongo);
    var errorHandler = function(err) { callback(err); };

    // Set up connect
    server.once('connect', function() {
      server.removeListener('error', errorHandler);
      callback(null, server);
    });

    server.once('error', errorHandler);

    // Connect
    try {
      server.connect();
    } catch (err) {
      server.removeListener('error', errorHandler);
      callback(err);
    }
  };

  // Additional parameters needed
  this.require = mongo;
  this.mongo = mongo;
  this.port = port;
  this.host = host;
  this.setName = setName;
  this.db = db;
  this.manager = manager;
  this.writeConcern = function() {
    return {w: 1};
  };
};

module.exports = Configuration;
