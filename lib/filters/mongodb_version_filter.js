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

  this.beforeStart = function(configuration, callback) {
    if (options.skip) return callback();

    if (configuration.type === 'core') {
      configuration.newConnection({ w: 1 }, function(err, topology) {
        if (err) {
          callback(err);
          return;
        }

        topology.command(f('%s.$cmd', configuration.db), { buildInfo: true }, function(
          commandErr,
          result
        ) {
          if (commandErr) throw commandErr;
          version = result.result.version;
          topology.destroy();
          callback();
        });
      });
    } else {
      configuration.newClient({ w: 1 }).connect(function(err, client) {
        if (err) {
          callback(err);
          return;
        }

        client.db('admin').command({ buildInfo: true }, function(_err, result) {
          if (_err) {
            callback(_err);
            return;
          }

          version = result.versionArray.slice(0, 3).join('.');
          console.log('running against mongodb version');
          console.dir(result);
          client.close();
          callback();
        });
      });
    }
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
