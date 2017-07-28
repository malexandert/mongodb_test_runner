'use strict';

// Check if we have a valid node.js method
var validVersion = function(compareVersion, versionRequired) {
  var comparator = versionRequired.slice(0, 1);
  var versionArray = null;

  // Figure out the comparator
  if (versionRequired.indexOf('>=') !== -1 || versionRequired.indexOf('<=') !== -1) {
    versionArray = versionRequired
      .slice(2).split(/\./).map(function(x) { return parseInt(x, 10); });
    comparator = versionRequired.slice(0, 2);
  } else if (versionRequired.indexOf('>') !== -1 || versionRequired.indexOf('<') !== -1 || versionRequired.indexOf('=') !== -1) {
    versionArray = versionRequired
      .slice(1).split(/\./).map(function(x) { return parseInt(x, 10); });
    comparator = versionRequired.slice(0, 1);
  }

  // Slice the arrays
  compareVersion = compareVersion.slice(0, 3);
  versionArray = versionArray.slice(0, 3);

  // Convert to actual number
  var cnumber = compareVersion[0] * 100 + compareVersion[1] * 10 + compareVersion[2];
  var ver = versionArray[0] * 100 + versionArray[1] * 10 + versionArray[2];

  // Comparator
  if (comparator === '>') {
    if (cnumber > ver) return true;
  } else if (comparator === '<') {
    if (cnumber < ver) return true;
  } else if (comparator === '=') {
    if (cnumber === ver) return true;
  } else if (comparator === '>=') {
    if (cnumber >= ver) return true;
  } else if (comparator === '<=') {
    if (cnumber <= ver) return true;
  }

  // No valid version
  return false;
};

exports.validVersion = validVersion;
