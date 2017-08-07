'use strict';

var OSFilter = function() {
  // Get environmental variables that are known
  var platform = process.platform;

  this.filter = function(test) {
    if (!test.metadata) return true;
    if (!test.metadata.requires) return true;
    if (!test.metadata.requires.os) return true;

    // Get the os
    var os = test.metadata.requires.os;

    if (os === platform) return true;
    // If !platform only allow running if the platform match
    if (os[0] === '!' && os !== ('!' + platform)) return true;
    return false;
  };
};

module.exports = OSFilter;
