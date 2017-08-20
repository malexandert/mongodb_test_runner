'use strict';

var f = require('util').format,
    inherits = require('util').inherits,
    semver = require('semver');

var ConfigurationBase = function(options) {
  this.options = options || {};
  this.host = options.host || 'localhost';
  this.port = options.port || 27017;
  this.db = options.db || 'integration_tests';
  this.manager = options.manager;
  this.mongo = options.mongo;
  this.skipStart = typeof options.skipStart === 'boolean' ? options.skipStart : false;
  this.skipTermination = typeof options.skipTermination === 'boolean' ? options.skipTermination : false;
  this.setName = options.setName || 'rs';
  this.require = this.mongo;
  this.writeConcern = function() {
    return {w: 1};
  };
};

ConfigurationBase.prototype.stop = function(callback) {
  if (this.skipTermination) return callback();
  // Stop the servers
  this.manager.stop().then(function() {
    callback();
  }).catch(function(err) {
    callback(err);
  });
};

ConfigurationBase.prototype.restart = function(opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {purge: true, kill: true};
  }
  if (this.skipTermination) return callback();

  // Stop the servers
  this.manager.restart().then(function() {
    callback();
  }).catch(function(err) {
    callback(err);
  });
};

ConfigurationBase.prototype.setup = function(callback) {
  callback();
};

ConfigurationBase.prototype.teardown = function(callback) {
  callback();
};

// Configuration for mongodb-core
var CoreConfiguration = function(options) {
  this.topology = options.topology || this.defaultTopology;

  ConfigurationBase.call(this, options);
};
inherits(CoreConfiguration, ConfigurationBase);

CoreConfiguration.prototype.defaultTopology = function(self, _mongo) {
  return new _mongo.Server({
    host: self.host,
    port: self.port
  });
};

CoreConfiguration.prototype.start = function(callback) {
  var self = this;
  if (this.skipStart) return callback();

  // Purge the database
  this.manager.purge()
    .then(function() {
      console.log('[purge the directories]');

      return self.manager.start();
    })
    .then(function() {
      console.log('[started the topology]');

      // Create an instance
      var server = self.topology(self, self.mongo);
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


CoreConfiguration.prototype.newTopology = function(opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  callback(null, this.topology(this, this.mongo));
};

CoreConfiguration.prototype.newConnection = function(opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  var server = this.topology(this, this.mongo);
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

// Configuration for mongodb
var NativeConfiguration = function(options) {
  ConfigurationBase.call(this, options);

  this.topology = options.topology || this.defaultTopology;
  this.replicasetName = options.replicasetName || 'rs';
};
inherits(NativeConfiguration, ConfigurationBase);

NativeConfiguration.prototype.defaultTopology = function(serverHost, serverPort, serverOpts) {
  return new this.mongo.Server(serverHost, serverPort, serverOpts || {});
};

NativeConfiguration.prototype.start = function(callback) {
  var ReplSetManager = require('mongodb-topology-manager').ReplSet;

  var self = this;
  if (this.skipStart) return callback();

  this.manager.discover()
    .then(function(result) {
      // Create string representation
      var currentVersion = result.version.join('.');
      console.log('==== Running against MongodDB ' + currentVersion);
      // If we have a ReplSetManager and the version is >= 3.4.0
      if (semver.satisfies(currentVersion, '>=3.4.0')) {
        if (self.manager instanceof ReplSetManager) {
          self.manager.managers = self.manager.managers.map(function(_manager) {
            _manager.options.enableMajorityReadConcern = null;
            return _manager;
          });
        }
      }

      return self.manager.purge();
    })
    .then(function() {
      console.log('[purge the directories]');

      return self.manager.start();
    })
    .then(function() {
      console.log('[started the topology]');

      // Create an instance
      new self.mongo.Db(self.db, self.topology(self.host, self.port)).open(function(err, _db) {
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

NativeConfiguration.prototype.newDbInstance = function(dbOptions, serverOptions) {
  serverOptions = serverOptions || {};
  // Override implementation
  if (this.options.newDbInstance) {
    return this.options.newDbInstance(dbOptions, serverOptions);
  }

  // Set up the options
  var keys = Object.keys(this.options);
  if (keys.indexOf('sslOnNormalPorts') !== -1) serverOptions.ssl = true;

  // Fall back
  var dbHost = serverOptions && serverOptions.host || 'localhost';
  var dbPort = serverOptions && serverOptions.port || this.options.port || 27017;

  // Default topology
  var DbTopology = this.mongo.Server;
  // If we have a specific topology
  if (this.options.topology) {
    DbTopology = this.options.topology;
  }

  // Return a new db instance
  return new this.mongo.Db(this.db, new DbTopology(dbHost, dbPort, serverOptions), dbOptions);
};

NativeConfiguration.prototype.newClient = function(dbOptions, serverOptions) {
  serverOptions = serverOptions || {};
  // Override implementation
  if (this.options.newDbInstance) {
    return this.options.newDbInstance(dbOptions, serverOptions);
  }

  // Set up the options
  var keys = Object.keys(this.options);
  if (keys.indexOf('sslOnNormalPorts') !== -1) serverOptions.ssl = true;

  // Fall back
  var dbHost = serverOptions && serverOptions.host || 'localhost';
  var dbPort = serverOptions && serverOptions.port || this.options.port || 27017;

  // Default topology
  var DbTopology = this.mongo.Server;
  // If we have a specific topology
  if (this.options.topology) {
    DbTopology = this.options.topology;
  }

  // Return a new MongoClient instance
  return new this.mongo.MongoClient(new DbTopology(dbHost, dbPort, serverOptions), dbOptions);
};

NativeConfiguration.prototype.newDbInstanceWithDomainSocket = function(dbOptions, serverOptions) {
  // Override implementation
  if (this.options.newDbInstanceWithDomainSocket) return this.options.newDbInstanceWithDomainSocket(dbOptions, serverOptions);

  // Default topology
  var DbTopology = this.mongo.Server;
  // If we have a specific topology
  if (this.options.topology) {
    DbTopology = this.options.topology;
  }

  // Fall back
  var dbHost = serverOptions && serverOptions.host || '/tmp/mongodb-27017.sock';

  // Set up the options
  var keys = Object.keys(this.options);
  if (keys.indexOf('sslOnNormalPorts') !== -1) serverOptions.ssl = true;
  // If we explicitly testing undefined port behavior
  if (serverOptions && serverOptions.port === 'undefined') {
    return new this.mongo.Db(this.db, new DbTopology(dbHost, undefined, serverOptions), dbOptions);
  }

  // Normal socket connection
  return new this.mongo.Db(this.db, new DbTopology(dbHost, serverOptions), dbOptions);
};

NativeConfiguration.prototype.url = function(username, password) {
  var url = this.options.url || 'mongodb://%slocalhost:27017/' + this.db;
  // Fall back
  var auth = '';
  if (username && password) {
    auth = f('%s:%s@', username, password);
  }

  return f(url, auth);
};

NativeConfiguration.prototype.writeConcern = function() {
  return clone(this.options.writeConcern || {w: 1});
};

NativeConfiguration.prototype.writeConcernMax = function() {
  return clone(this.options.writeConcernMax || {w: 1});
};

var clone = function(obj) {
  var copy = {};
  for (var name in obj) copy[name] = obj[name];
  return copy;
};

module.exports = {
  ConfigurationBase: ConfigurationBase,
  NativeConfiguration: NativeConfiguration,
  CoreConfiguration: CoreConfiguration
};
