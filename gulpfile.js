var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var ngAnnotate = require('gulp-ng-annotate');
var path = require('path');
var plumber = require('gulp-plumber');
var jshint = require('gulp-jshint');
var eventStream = require('event-stream');

// Root directory
var rootDirectory = path.resolve('./');

// Source directory for build process
var sourceDirectory = path.join(rootDirectory, './src');

var sourceFiles = [
  path.join(sourceDirectory, '/**/*.js')
];

var lintFiles = [
  'gulpfile.js',
  // Karma configuration
  // 'karma-*.conf.js'
].concat(sourceFiles);


// Build JavaScript distribution files
gulp.task('build', function() {
  return eventStream.merge(gulp.src(sourceFiles))
    .pipe(plumber())
    .pipe(concat('angular-actioncable.js'))
    .pipe(gulp.dest('./dist/'))
    .pipe(ngAnnotate())
    .pipe(uglify({mangle: false}))
    .pipe(rename('angular-actioncable.min.js'))
    .pipe(gulp.dest('./dist/'));
});


// Validate source JavaScript
gulp.task('jshint', function () {
  gulp.src(lintFiles)
    .pipe(plumber())
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'))
    .pipe(jshint.reporter('fail'));
});
