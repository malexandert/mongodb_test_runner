'use strict';

var semver = require('semver'),
    f = require('util').format;

/**
 * Filter for the MongoDB version required for the test
 * 
 * example: 
 * metadata: {
 *    requires: {
 *      mongodb: 'mongodbSemverVersion'
 *    }
 * }
 */
var MongoDBVersionFilter = function(options) {
  options = options || {};
  // Get environmental variables that are known
  var version = null;

  this.beforeStart = function(object, callback) {
    if (options.skip) return callback();
    // Get the first configuration
    var configuration = object.configurations[0];
    // Get the MongoDB version
    configuration.newConnection({ w: 1 }, function(err, topology) {
      if (err) {
        // console.log(err.stack);
        callback();
      }

      topology.command(f('%s.$cmd', configuration.db), {buildInfo: true}, function(commandErr, result) {
        if (commandErr) throw commandErr;
        version = result.result.version;
        topology.destroy();
        callback();
      });
    });
  };

  this.filter = function(test) {
    if (options.skip) return true;
    if (!test.metadata) return true;
    if (!test.metadata.requires) return true;
    if (!test.metadata.requires.mongodb) return true;
    return semver.satisfies(version, test.metadata.requires.mongodb);
  };
};

module.exports = MongoDBVersionFilter;
