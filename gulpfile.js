const gulp = require('gulp')
const babel = require('gulp-babel')

gulp.src('src/*.js').pipe(babel()).pipe(gulp.dest('dist/'))
