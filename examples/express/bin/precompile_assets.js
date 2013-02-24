'use strict';

var Mincer = require('mincer'),
    _ = require('underscore'),
    uglifyjs = require('uglify-js'),
    csso = require('csso'),
    fs = require('fs'),
    zlib = require('zlib'),
    async = require('async'),
    wrench = require('wrench')
;

// remove existing manifest/assets if it exists
if (fs.existsSync('./public/assets')) {
  wrench.rmdirSyncRecursive('./public/assets');
}

var environment = new Mincer.Environment('./');

/**
 * This minifies Javascript using the UglifyJS2 default compression settings. It also
 * preserves certain comments (the same ones as when you call uglifyjs with the --comments
 * option)
 */
environment.jsCompressor = function(context, data, callback) {
  try {
    var min = uglifyjs.minify(data, {
      fromString: true,
      output: {
        comments: function(node, comment) {
          var text = comment.value;
          var type = comment.type;
          if (type == 'comment2') {
            return (/@preserve|@license|@cc_on/i).test(text);
          }
        }
      }
    });
    callback(null, min.code);
  } catch (err) {
    console.err(err);
    callback(err);
  }
};

/**
 * This minifies CSS using the Csso default compression options.
 */
environment.cssCompressor = function(context, data, callback) {
  try {
    callback(null, csso.justDoIt(data));
  } catch (err) {
    console.err(err);
    callback(err);
  }
};

[
  'assets/images',
  'assets/css',
  'assets/js',
  'vendor/css',
  'vendor/js'
].forEach(function(path) {
  environment.appendPath(path);
});

var manifest = new Mincer.Manifest(environment, './public/assets');

console.info('Starting asset compilation');

manifest.compile(['*', '*/**'], function(err, manifestData) {
  if (!manifestData) {
    console.info('No assets to compile');
  } else {
    var files = _(manifestData.files).keys();

    // gzip each file into a .gz file in the same directory
    async.each(files, function(file, done) {
      var gzip = zlib.createGzip({
        level: 9
      });
      var inp = fs.createReadStream('./public/assets/' + file);
      var out = fs.createWriteStream('./public/assets/' + file + '.gz');
      inp.pipe(gzip).pipe(out);
      done();
    }, function() {
      console.info('Finished compiling ' + files.length + ' assets');
    });
  }
});
