'use strict';

var fs = require('fs')
  , path = require('path')
  , f = require('util').format
  , Metamocha = require('metamocha').Metamocha
  , Configuration = require('./test_configuration')
  , ServerManager = require('mongodb-topology-manager').Server
  , ReplSetManager = require('mongodb-topology-manager').ReplSet
  , ShardingManager = require('./sharding_test_topology').Sharded;

var argv = require('optimist')
    .usage('Usage: $0 -f [file] -e [environment]')
    .demand('f')
    .argv;
 
// Instantiate new Metaocha instance
var metamocha = new Metamocha();

// Adding tests
metamocha.addFolder(argv.f);

// Skipping parameters
var startupOptions = {
    skipStartup: false
  , skipRestart: false
  , skipShutdown: false
  , skip: false
}
 
// Skipping parameters
if(argv.s) {
  var startupOptions = {
      skipStartup: true
    , skipRestart: true
    , skipShutdown: true
    , skip: false
  }
}

// Configure mongod 
var config;
if(argv.e == 'replicaset') {
  config = {
      host: 'localhost', port: 31000, setName: 'rs'
    , topology: function(self, _mongo) {
      return new _mongo.ReplSet([{
          host: 'localhost', port: 31000
      }], { setName: 'rs' });
    }
    , manager: new ReplSetManager('mongod', [{
      tags: {loc: 'ny'},
      // mongod process options
      options: {
        bind_ip: 'localhost',
        port: 31000,
        dbpath: f('%s/../db/31000', __dirname)
      }
    }, {
      tags: {loc: 'sf'},
      options: {
        bind_ip: 'localhost',
        port: 31001,
        dbpath: f('%s/../db/31001', __dirname)
      }
    }, {
      tags: {loc: 'sf'},
      priority:0,
      options: {
        bind_ip: 'localhost',
        port: 31002,
        dbpath: f('%s/../db/31002', __dirname)
      }
    }, {
      tags: {loc: 'sf'},
      options: {
        bind_ip: 'localhost',
        port: 31003,
        dbpath: f('%s/../db/31003', __dirname)
      }
    }, {
      arbiter: true,
      options: {
        bind_ip: 'localhost',
        port: 31004,
        dbpath: f('%s/../db/31004', __dirname)
      }
    }], {
      replSet: 'rs'
    })
  }
} else if(argv.e == 'sharded') {
  config = {
      host: 'localhost'
    , port: 51000
    , skipStart: startupOptions.skipStartup
    , skipTermination: startupOptions.skipShutdown
    , topology: function(self, _mongo) {
      return new _mongo.Mongos([{
          host: 'localhost'
        , port: 51000
      }]);
    }, manager: new ShardingManager({

    })
  }
} else if(argv.e == 'auth') {
  config = {
      host: 'localhost'
    , port: 27017
    , skipStart: startupOptions.skipStartup
    , skipTermination: startupOptions.skipShutdown
    , manager: new ServerManager('mongod', {
      dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
      auth:null
    })
  }
} else { // Default
  config = {
      host: 'localhost'
    , port: 27017
    , skipStart: startupOptions.skipStartup
    , skipTermination: startupOptions.skipShutdown
    , manager: new ServerManager('mongod', {
      dbpath: path.join(path.resolve('db'), f("data-%d", 27017))
    })
  }
} 

// Add filters
// Add a Node version plugin
metamocha.addFilter(new NodeVersionFilter(startupOptions));

if (!argv.s) {
  // Add a MongoDB version plugin
  metamocha.addFilter(new MongoDBVersionFilter(startupOptions));
}

// Add a Topology filter plugin
metamocha.addFilter(new MongoDBTopologyFilter(startupOptions));
// Add a Filter allowing us to specify that a function requires Promises
metamocha.addFilter(new ES6PromisesSupportedFilter())
// Add a Filter allowing us to validate if generators are available
metamocha.addFilter(new ES6GeneratorsSupportedFilter())


// Setup database
var dbConfig = Configuration(config)({});
dbConfig.start(function() {

  // Run the tests
  metamocha.run(dbConfig, function(failures) {
    process.on('exit', function() {
      process.exit(failures);
    });

    dbConfig.stop(function() {
      process.exit();
    });
  });
});