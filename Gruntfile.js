module.exports = function(grunt) {

  grunt.initConfig({
    watch: {
      main: {
        files: ['daemon.js'],
        tasks: ['develop'],
        options: { nospawn: true }
      }
    },
    develop: {
      daemon: {
        file: 'daemon.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-develop');

  grunt.registerTask('default', ['develop', 'watch']);
};
