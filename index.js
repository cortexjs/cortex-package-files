'use strict';

module.exports = pf;

var glob = require('glob');
var ignore = require('ignore');
var node_path = require('path');
var util = require('util');

var SUPPORTED_DIRECTORIES = [
  'src',
  'dist'
];

// Get the file list to be packaged
// @param {Object} options
// - cwd: {path}
// - pkg: {Object} package object
// - more: {Boolean} include special files according to package data
function pf (options, callback) {
  var cwd = options.cwd;

  // copy filtered files to the temp dir
  glob('**', {
    cwd: cwd,
    // include .dot files
    dot: true,
    // Adds a `/` character to directory matches 
    mark: true

  }, function(err, files) {
    if (err) {
      return callback(err);
    }

    var filter = pf._create_filter(options);

    var REGEX_ENDS_BACKSLASH = /\/$/;
    files = files
      // Filter dirs
      .filter(function (file) {
        return !REGEX_ENDS_BACKSLASH.test(file);
      })
      .filter(filter);

    callback(null, files);
  });
}

pf._create_filter = function (options) {
  var pkg = options.pkg;
  var cwd = options.cwd;
  var ignore_rules = pkg.ignores || [];
  var ignore_files = [
        '.cortexignore',
        '.gitignore'
      ].map(function (file) {
        return node_path.join(cwd, file);
      });
  var ignore_file = ignore.select(ignore_files);

  var ig = ignore()
    .addPattern([
      // Always ignored
      'neurons/',
      // cortexjs/cortex#297: by default, we will ignore 'node_modules' directory
      'node_modules/'
    ])
    .addIgnoreFile(ignore_file)
    .addPattern(ignore_rules);

  if (options.more) {
    ig
      // Which is needed by cortex,
      // or there will be errors if install
      .addPattern(pf._directories_pattern(pkg))
      .addPattern(pf._css_pattern(pkg));
  }

  ig.addPattern([
    // You could never ignore this.
    '!/package.json',
    '!/cortex.json',
    '!/cortex-shrinkwrap.json',
    '!/README.*'
  ]);

  return ig.createFilter();
};


pf._directories_pattern = function (pkg) {
  var directories = pkg.directories || {};

  // cortexjs/cortex#270: package.directories should not be ignored, even it appears in .gitignore.
  // There are files which generated by `scripts.prebuild` or `scripts.prepublish`,
  // and developers might adds them into .gitignore,
  // but cortex needs them.
  var include_directories = 
    Object.keys(directories)
    .map(function(key) {
      if (!~SUPPORTED_DIRECTORIES.indexOf(key)) {
        return;
      }
      // Make sure the path pattern consisted with the glob result.
      var dir = node_path.join('.', directories[key]);
      var ignore_negative = '!/' + dir.replace(/\/$/, '') + '/*';
      return ignore_negative;
    })
    .filter(Boolean);

  return include_directories;
};


pf._css_pattern = function (pkg) {
  var include_css = pkg.css
    ? pf._to_array(pkg.css).map(function (css) {
        // './abc.css' -> 'abc.css'
        return '!/' + node_path.join('.', css);
      })
    : [];

  return include_css;
};


pf._to_array = function (subject) {
  return util.isArray(subject)
    ? subject
    : subject === undefined
      ? []
      : [subject];
}
