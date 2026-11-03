module.exports = function(grunt) {

  grunt.loadNpmTasks("grunt-contrib-less");
  grunt.loadNpmTasks("grunt-contrib-watch");

  grunt.initConfig({
    less: {
      light: {
        files: {
          "css/caret.css": "css/seed.less",
          "css/caret-twilight.css": "css/seed-twilight.less",
          "css/caret-dark.css": "css/seed-dark.less"
        }
      }
    },
    watch: {
      css: {
        files: ["css/*.less"],
        tasks: ["less"]
      },
      options: {
        spawn: false
      }
    }
  });

  // `grunt` compiles the CSS and recompiles it as you edit.
  // `npm run build` compiles once and generates precache.js for the service worker.
  grunt.registerTask("default", ["less", "watch"]);

  grunt.registerTask("checkLocale", "Finds unregistered strings for a given locale; checkLocale:XX for a language code XX", function(language) {
    var english = require("./_locales/en/messages.json");
    var other = require(`./_locales/${language}/messages.json`);
    console.log(`Checking ${language} against English string file`);
    for (var k in english) {
      if (!(k in other)) {
        console.log(`- Missing string: ${k}`);
      }
    }
  })

};
