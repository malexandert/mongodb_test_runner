'use strict';

var f = require('util').format,
    semver = require('semver'),
    ReplSetManager = require('mongodb-topology-manager').ReplSet;

var NativeConfiguration = function(options) {
  options = options || {};
  var host = options.host || 'localhost';
  var port = options.port || 27017;
  var db = options.db || 'integration_tests';
  var url = options.url || 'mongodb://%slocalhost:27017/' + db;
  var manager = options.manager;
  var mongo = options.mongo;
  var skipStart = typeof options.skipStart === 'boolean' ? options.skipStart : false;
  var skipTermination = typeof options.skipTermination === 'boolean' ? options.skipTermination : false;
  var setName = options.setName || 'rs';
  var replicasetName = options.replicasetName || 'rs';

  // Write concerns
  var writeConcern = options.writeConcern || {w: 1};
  var writeConcernMax = options.writeConcernMax || {w: 1};

  // Default function
  var defaultFunction = function(serverHost, serverPort, serverOpts) {
    return new mongo.Server(serverHost, serverPort, serverOpts || {});
  };

  // Create a topology function
  var topology = options.topology || defaultFunction;

  this.start = function(callback) {
    var self = this;
    if (skipStart) return callback();

    manager.discover()
      .then(function(result) {
        // Create string representation
        var currentVersion = result.version.join('.');
        console.log('==== Running against MongodDB ' + currentVersion);
        // If we have a ReplSetManager and the version is >= 3.4.0
        if (semver.satisfies(currentVersion, '>=3.4.0')) {
          if (manager instanceof ReplSetManager) {
            manager.managers = manager.managers.map(function(_manager) {
              _manager.options.enableMajorityReadConcern = null;
              return _manager;
            });
          }
        }

        return manager.purge();
      })
      .then(function() {
        console.log('[purge the directories]');

        return manager.start();
      })
      .then(function() {
        console.log('[started the topology]');

        // Create an instance
        new mongo.Db(self.db, topology(host, port)).open(function(err, _db) {
          console.log('[get connection to topology]');
          if (err) return callback(err);

          _db.dropDatabase(function(_err) {
            console.log('[dropped database]');
            _db.close();
            callback();
          });
        });
      }).catch(function(err) {
        callback(err);
      });
  };

  this.stop = function(callback) {
    if (skipTermination) return callback();
    // Stop the servers
    manager.stop(9).then(function() {
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

  this.newDbInstance = function(dbOptions, serverOptions) {
    serverOptions = serverOptions || {};
    // Override implementation
    if (options.newDbInstance) {
      return options.newDbInstance(dbOptions, serverOptions);
    }

    // Set up the options
    var keys = Object.keys(options);
    if (keys.indexOf('sslOnNormalPorts') !== -1) serverOptions.ssl = true;

    // Fall back
    var dbHost = serverOptions && serverOptions.host || 'localhost';
    var dbPort = serverOptions && serverOptions.port || options.port || 27017;

    // Default topology
    var DbTopology = mongo.Server;
    // If we have a specific topology
    if (options.topology) {
      DbTopology = options.topology;
    }

    // Return a new db instance
    return new mongo.Db(db, new DbTopology(dbHost, dbPort, serverOptions), dbOptions);
  };

  this.newDbInstanceWithDomainSocket = function(dbOptions, serverOptions) {
    // Override implementation
    if (options.newDbInstanceWithDomainSocket) return options.newDbInstanceWithDomainSocket(dbOptions, serverOptions);

    // Default topology
    var DbTopology = mongo.Server;
    // If we have a specific topology
    if (options.topology) {
      DbTopology = options.topology;
    }

    // Fall back
    var dbHost = serverOptions && serverOptions.host || '/tmp/mongodb-27017.sock';

    // Set up the options
    var keys = Object.keys(options);
    if (keys.indexOf('sslOnNormalPorts') !== -1) serverOptions.ssl = true;
    // If we explicitly testing undefined port behavior
    if (serverOptions && serverOptions.port === 'undefined') {
      return new mongo.Db(db, new DbTopology(dbHost, undefined, serverOptions), dbOptions);
    }

    // Normal socket connection
    return new mongo.Db(db, new DbTopology(dbHost, serverOptions), dbOptions);
  };

  this.url = function(username, password) {
    // Fall back
    var auth = '';
    if (username && password) {
      auth = f('%s:%s@', username, password);
    }

    return f(url, auth);
  };

  // Additional parameters needed
  this.database = db || options.db;
  this.require = mongo;
  this.mongo = mongo;
  this.port = port;
  this.host = host;
  this.setName = setName;
  this.db = db;
  this.manager = manager;
  this.replicasetName = replicasetName;
  this.writeConcern = function() {
    return clone(writeConcern);
  };
  this.writeConcernMax = function() {
    return clone(writeConcernMax);
  };
};

var clone = function(obj) {
  var copy = {};
  for (var name in obj) copy[name] = obj[name];
  return copy;
};

module.exports = NativeConfiguration;
