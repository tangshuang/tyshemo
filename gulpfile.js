const gulp = require('gulp')
const babel = require('gulp-babel')

gulp.src('es/**/*.js').pipe(babel()).pipe(gulp.dest('cjs/'))
