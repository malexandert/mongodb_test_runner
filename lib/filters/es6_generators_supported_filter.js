'use strict';

var ES6GeneratorsSupportedFilter = function() {
  this.beforeStart = function(object, callback) {
    callback();
  };

  this.filter = function(test) {
    if (test.metadata === null) return true;
    if (test.metadata.requires === null) return true;
    if (test.metadata.requires.generators === null) return true;
    if (test.metadata.requires.generators === false) return true;
    var check = false;

    try {
      eval('(function *(){})');   // eslint-disable-line
      check = true;
    } catch (err) { }  // eslint-disable-line

    // Do not execute the test
    return check;
  };
};

module.exports = ES6GeneratorsSupportedFilter;
