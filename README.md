# Dustify
The Grunt task to pre-compile templates for production.

### Example Config
```js
// Inside your Gruntfile.js
dustify: {
  templates: {
    src: [
      'server/views/layout/simple.dust'
    , 'server/views/index.dust'
    ]
  , dest: '<%= paths.client.build %>/js/templates.js'
  , options: {
      base: 'server/views'
    , dustAlias: 'dust'
    , alias: [
        // aliases one template for another
        'layout/bodyContent:layout/default'
      ]
    }
  }
}
```

...more to come.
