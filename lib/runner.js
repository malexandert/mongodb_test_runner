#!/usr/bin/env node

'use strict';

var path = require('path'),
    f = require('util').format,
    fs = require('fs'),
    m = require('mongodb-version-manager'),
    Metamocha = require('metamocha').Metamocha,
    CoreConfiguration = require('./config/test_configuration').CoreConfiguration,
    NativeConfiguration = require('./config/test_configuration').NativeConfiguration,
    ServerManager = require('mongodb-topology-manager').Server,
    ReplSetManager = require('mongodb-topology-manager').ReplSet,
    ShardingManager = require('mongodb-topology-manager').Sharded,
    setupShardedCluster = require('./config/sharding_topology_setup').setupShardedCluster,
    NodeVersionFilter = require('./filters/node_version_filter'),
    MongoDBVersionFilter = require('./filters/mongodb_version_filter'),
    MongoDBTopologyFilter = require('./filters/mongodb_topology_filter'),
    TravisFilter = require('./filters/travis_filter');

var argv = require('yargs')
  .wrap(null)
  .options({
    'f': {
      alias: 'filepath',
      describe: 'Path to the tests, can be either a file or a directory',
      demandOption: true
    },
    'e': {
      alias: 'environment',
      describe: 'MongoDB environment to run the tests against',
      default: 'single'
    },
    's': {
      alias: 'skipStartup',
      describe: 'Skips the MongoDB environment setup. Used when a local MongoDB instance is preferred over the one created by the test runner, or when a mock server is running'
    },
    't': {
      alias: 'timeout',
      describe: 'Timeout time for the tests, in ms',
      default: 30000
    }
  })
  .usage('Usage: $0 -f [filepath] -e [environment] -s [skipStartup] -t [timeout]')
  .argv;


// Instantiate new Metaocha instance
var metamocha = new Metamocha({timeout: argv.t});

// Adding tests
if (fs.lstatSync(argv.f).isDirectory()) {
  metamocha.addFolderRec(argv.f);
} else {
  metamocha.addFile(argv.f);
}

// Skipping parameters
var startupOptions = {
  skipStartup: false,
  skipRestart: false,
  skipShutdown: false,
  skip: false
};

// Skipping parameters
if (argv.s) {
  startupOptions.skipStartup = true;
  startupOptions.skipRestart = true;
  startupOptions.skipShutdown = true;
}

// Configure mongod 
var config;
if (argv.e === 'replicaset') {
  config = {
    host: 'localhost',
    port: 31000,
    setName: 'rs',
    topology: function(self, _mongo) {
      return new _mongo.ReplSet([{
        host: 'localhost', port: 31000
      }], { setName: 'rs' });
    },
    manager: new ReplSetManager('mongod', [{
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
      priority: 0,
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
  };
} else if (argv.e === 'sharded') {
  config = {
    host: 'localhost',
    port: 51000,
    skipStart: startupOptions.skipStartup,
    skipTermination: startupOptions.skipShutdown,
    topology: function(self, _mongo) {
      return new _mongo.Mongos([{
        host: 'localhost',
        port: 51000
      }]);
    }, manager: setupShardedCluster(new ShardingManager({}))
  };
} else if (argv.e === 'auth') {
  config = {
    host: 'localhost',
    port: 27017,
    skipStart: startupOptions.skipStartup,
    skipTermination: startupOptions.skipShutdown,
    manager: new ServerManager('mongod', {
      dbpath: path.join(path.resolve('db'), f('data-%d', 27017)),
      auth: null
    })
  };
} else { // Default
  config = {
    host: 'localhost',
    port: 27017,
    skipStart: startupOptions.skipStartup,
    skipTermination: startupOptions.skipShutdown,
    manager: new ServerManager('mongod', {
      dbpath: path.join(path.resolve('db'), f('data-%d', 27017))
    })
  };
}

// Setup database
var findMongo = function(packagePath) {
  if (fs.existsSync(f('%s/package.json', packagePath))) {
    var obj = JSON.parse(fs.readFileSync(f('%s/package.json', packagePath)));
    if (obj.name && (obj.name === 'mongodb-core' || obj.name === 'mongodb')) {
      return {
        path: packagePath,
        package: obj.name
      };
    }

    return findMongo(path.dirname(packagePath));
  } else if (packagePath === '/') {
    return false;
  }

  return findMongo(path.dirname(packagePath));
};

var mongoPackage = findMongo(path.dirname(module.filename));

var dbConfig;
try {
  config.mongo = require(mongoPackage.path);
  if (mongoPackage.package === 'mongodb-core') {
    dbConfig = new CoreConfiguration(config);
  } else if (mongoPackage.package === 'mongodb') {
    dbConfig = new NativeConfiguration(config);
  }
} catch (err) {
  throw new Error('The test runner must be a dependency of mongodb or mongodb-core');
}

// Add filters
// Add a Node version plugin
metamocha.addFilter(new NodeVersionFilter());

if (!argv.s) {
  // Add a MongoDB version plugin
  metamocha.addFilter(new MongoDBVersionFilter());
}

// Add a Topology filter plugin
metamocha.addFilter(new MongoDBTopologyFilter({ runtimeTopology: argv.e }));

// Travis filter
metamocha.addFilter(new TravisFilter());

// Callback after test run
var onFinish = function(skipStartup) {
  return function(failures) {
    process.on('exit', function() {
      process.exit(failures);
    });

    if (!skipStartup) {
      dbConfig.stop(function() {
        process.exit();
      });
    }
  };
};

if (startupOptions.skipStartup || argv.s) {
  metamocha.run(dbConfig, onFinish());
}

m(function(err) {
  dbConfig.start(function() {
    // Run the tests
    metamocha.run(dbConfig, onFinish);
  });
});
