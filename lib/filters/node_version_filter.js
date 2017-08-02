'use strict';

var semver = require('semver');

var NodeVersionFilter = function() {
  var version = process.version;

  this.filter = function(test) {
  	if (!test.metadata) return true;
  	if (!test.metadata.requires) return true;
  	if (!test.metadata.requires.node) return true;
  	// Return if this is a valid method
    return semver.satisfies(version, test.metadata.requires.node);
  };
};

module.exports = NodeVersionFilter;
