// # Dustify
// ### Compile dust files into a single js file.

module.exports = function dustify (grunt) {
  function compileTask () {
    var finished = this.async()
      , path = require('path')
      , fs = require('fs')
      , Promise = require('bluebird')
      , pStat = Promise.promisify(fs.stat)
      , _ = require('lodash')
      , dust = require('dustjs-linkedin')
      , opts = this.options({
          base: '.'
        , dustAlias: 'dustjs-helpers'
        , ext: '.dust'
        , onlyUpdated: true
        })
      , da = opts.dustAlias
      , aliases = false

    // Handle aliases, which allows us to rename template files in the registry
    if (opts.alias && _.isArray(opts.alias)) {
      aliases = {}

      _.flatten(opts.alias).forEach(function(alias) {
        var parts = alias.split(':')
        aliases[parts[0]] = parts[1]
      })
    }

    // ### getFileSource
    // Retrieves the utf8 source of a file and returns an object just
    // like what is stored in `mappedSource`.
    function getFileSource(src, mtime) {
      var source = grunt.file.read(src)
        , name = path.relative(opts.base, src).replace(opts.ext, '')
        , result

      name = aliases && aliases[name] || name

      return Promise.resolve(mtime || pStat(src))
        .then(function(stats) {
          var mtime = stats.mtime ? stats.mtime.getTime() : stats
          return [dust.compile(source, name), mtime]
        })
        .spread(function(func, mtime) {
          return {name: name, src: src, mtime: mtime, func: func}
        })
    }

    // ## Map over grunt files array.
    Promise.map(this.files, function(files) {
      var mappedSource = {}
        , destSource

      // If we are updating only updated dust files (default) then we need
      // to parse the destination file. (Since there is only a single dest
      // file associated with each set of files we can do this sync.)
      if (opts.onlyUpdated && grunt.file.exists(files.dest)) {
        destSource = grunt.file.read(files.dest)
        destSource = destSource.substr(destSource.indexOf('//'))
        destSource = destSource.split('\n\n')

        _(destSource).map(function(source) {
          return source.split('\n')
        }).each(function(parts) {
          var srcTime = parts[1].substr(3).split(':')
          mappedSource[srcTime[0]] = {
            name: parts[0].substr(3)
          , src: srcTime[0]
          , mtime: srcTime[1]
          , func: parts[2]
          }
        })
      }

      // ## Map over file sources.
      return Promise.map(files.src, function(src) {
          // If we are compiling everything or this file is new
          if (!opts.onlyUpdated || !mappedSource[src]) {
            grunt.verbose.writeln('Dustify: compiling ' + src)
            return getFileSource(src)
          }

          return pStat(src).then(function(stats) {
            var mtime = stats.mtime.getTime()
            // If mtime is newer than in our file, re-compile it.
            if (mtime > mappedSource[src].mtime) {
              grunt.log.writeln('Dustify: recompiling ' + src)
              return getFileSource(src, mtime)
            }

            // Otherwise, we just return our cached intance to be rewritten.
            return mappedSource[src]
          })
        })
        .then(function(mapped) {
          // Map over `mappedSource` and `getFileSource` objects turning them
          // into an array of stringed sources for writting.
          mapped = _.map(mapped, function(part) {
            return [ ('// ' + part.name)
                   , ('// ' + part.src + ':' + part.mtime)
                   , part.func
                   ].join('\n')
          })

          return mapped
        })
        .then(function(templates) {
          // Inject our dust dependancy at the top of our templates array
          // and write it to out.
          templates.unshift("var dust = module.exports = require('" + da + "');")
          grunt.file.write(files.dest, templates.join('\n\n'))
        })
    })
    .catch(finished)
    .done(finished)
  }

  grunt.registerMultiTask('dustify',
                          'Compile Dust templates into a single file'.yellow,
                          compileTask)
}
