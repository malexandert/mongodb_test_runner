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

    // console.log("----------------------------------------------------------")
    // console.log(test.metadata.requires.os)
    // console.log(platform)
    // console.log(os[0] == '!')
    // console.log(os != ("!" + platform))

    if (os === platform) return true;
    // If !platform only allow running if the platform match
    if (os[0] === '!' && os !== ('!' + platform)) return true;
    // console.log("---------------------------------------------------------- 1")
    // console.log("---------------------------------------------------------- 2")
    return false;
  };
};

module.exports = OSFilter;
