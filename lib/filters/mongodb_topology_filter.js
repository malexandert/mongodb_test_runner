'use strict';

/**
 * Filter for the MongoDB toopology required for the test
 * 
 * example: 
 * metadata: {
 *    requires: {
 *      topology: 'single' | 'replicaset' | 'sharded' | 'auth' | 'ssl'
 *    }
 * }
 */
var MongoDBTopologyFilter = function(options) {
  var runtimeTopology = options.runtimeTopology || 'single';

  this.filter = function(test) {
    if (!test.metadata) return true;
    if (!test.metadata.requires) return true;
    if (!test.metadata.requires.topology) return true;

    // If we have a single topology convert to single item array
    var topologies = null;

    if (typeof test.metadata.requires.topology === 'string') {
      topologies = [test.metadata.requires.topology];
    } else if (Array.isArray(test.metadata.requires.topology)) {
      topologies = test.metadata.requires.topology;
    } else {
      throw new Error('MongoDBTopologyFilter only supports single string topology or an array of string topologies');
    }

    // Check if we have an allowed topology for this test
    for (var i = 0; i < topologies.length; i++) {
      if (topologies[i] === runtimeTopology) return true;
    }

    // Do not execute the test
    return false;
  };
};

module.exports = MongoDBTopologyFilter;
