'use strict';

/**
 * Filter for whether Travis should run the test
 * 
 * example: 
 * metadata: {
 *    ignore: {
 *      travis: true | false
 *    }
 * }
 */  
var TravisFilter = function(name) {
  name = name || 'TRAVIS_JOB_ID';

  this.filter = function(test) {
    if (!test.metadata) return true;
    if (!test.metadata.ignore) return true;
    if (!test.metadata.ignore.travis) return true;
    if (process.env[name] !== null && test.metadata.ignore.travis === true) return false;
    return true;
  };
};

module.exports = TravisFilter;
