'use strict';

var TravisFilter = function(name) {
  // console.dir(process.env)
  name = name || 'TRAVIS_JOB_ID';

  // Get environmental variables that are known
  this.filter = function(test) {
    if (!test.metadata) return true;
    if (!test.metadata.ignore) return true;
    if (!test.metadata.ignore.travis) return true;
    if (process.env[name] !== null && test.metadata.ignore.travis === true) return false;
    return true;
  };
};

module.exports = TravisFilter;
