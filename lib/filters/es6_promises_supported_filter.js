'use strict';

var ES6PromisesSupportedFilter = function() {
  this.beforeStart = function(object, callback) {
    callback();
  };

  this.filter = function(test) {
    if (test.metadata === null) return false;
    if (test.metadata.requires === null) return false;
    if (test.metadata.requires.promises === null) return false;
    if (test.metadata.requires.promises === false) return false;
    var check = true;

    try {
      var promise = new Promise(function() {}); // eslint-disable-line
      check = false;
    } catch (err) {} // eslint-disable-line

    return check;
  };
};

module.exports = ES6PromisesSupportedFilter;
