'use strict';

var semver = require('semver');

/**
 * Filter for the Node version required for the test
 * 
 * example: 
 * metadata: {
 *    requires: {
 *      node: 'nodeSemverVersion'
 *    }
 * }
 */
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
