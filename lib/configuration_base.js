'use strict';

var ConfigurationBase = function(options) {
  this.options = options || {};
  this.host = options.host || 'localhost';
  this.port = options.port || 27017;
  this.db = options.db || 'integration_tests';
  this.manager = options.manager;
  this.mongo = options.mongo;
  this.skipStart = typeof options.skipStart === 'boolean' ? options.skipStart : false;
  this.skipTermination =
    typeof options.skipTermination === 'boolean' ? options.skipTermination : false;
  this.setName = options.setName || 'rs';
  this.require = this.mongo;
  this.writeConcern = function() {
    return { w: 1 };
  };
};

ConfigurationBase.prototype.stop = function(callback) {
  if (this.skipTermination) return callback();
  // Stop the servers
  this.manager
    .stop()
    .then(function() {
      callback(null);
    })
    .catch(function(err) {
      callback(err, null);
    });
};

ConfigurationBase.prototype.restart = function(opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = { purge: true, kill: true };
  }
  if (this.skipTermination) return callback();

  // Stop the servers
  this.manager
    .restart()
    .then(function() {
      callback(null);
    })
    .catch(function(err) {
      callback(err, null);
    });
};

ConfigurationBase.prototype.setup = function(callback) {
  callback();
};

ConfigurationBase.prototype.teardown = function(callback) {
  callback();
};

module.exports = ConfigurationBase;
