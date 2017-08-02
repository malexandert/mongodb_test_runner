'use strict';

// console.log(argv._);
var argv = require('optimist')
  .usage('Usage: $0 -f [file] -e [environment]')
  .demand(['f'])
  .argv;

var MongoDBTopologyFilter = function() {
  this.filter = function(test) {
    var serverConfig = argv.e || 'single';

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
      if (topologies[i] === serverConfig) return true;
    }

  	// Do not execute the test
  	return false;
  };
};

module.exports = MongoDBTopologyFilter;
