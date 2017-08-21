'use strict';

var ES6PromisesSupportedFilter = function() {
  this.beforeStart = function(object, callback) {
    callback();
  };

  this.filter = function(test) {
    if (test.metadata === null) return true;
    if (test.metadata.requires === null) return true;
    if (test.metadata.requires.promises === null) return true;
    if (test.metadata.requires.promises === false) return true;
    var check = false;

    try {
      var promise = new Promise(function() {}); // eslint-disable-line
      check = true;
    } catch (err) { } // eslint-disable-line

    return check;
  };
};

module.exports = ES6PromisesSupportedFilter;
