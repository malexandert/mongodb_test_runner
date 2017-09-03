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
  ES6PromisesSupportedFilter = require('./filters/es6_promises_supported_filter'),
  ES6GeneratorsSupportedFilter = require('./filters/es6_generators_supported_filter'),
  TravisFilter = require('./filters/travis_filter');

var argv = require('yargs')
  .wrap(null)
  .options({
    e: {
      alias: 'environment',
      describe: 'MongoDB environment to run the tests against',
      default: 'single'
    },
    s: {
      alias: 'skipStartup',
      describe:
        'Skips the MongoDB environment setup. Used when a local MongoDB instance is preferred over the one created by the test runner'
    },
    t: {
      alias: 'timeout',
      describe: 'Timeout time for the tests, in ms',
      default: 30000
    },
    l: {
      alias: 'local',
      describe:
        'Skips downloading MongoDB, and instead uses an existing installation of the server',
      type: 'boolean'
    }
  })
  .usage('Usage: $0 -e [environment] -s [skipStartup] [files]').argv;

// Instantiate new Metaocha instance
var metamocha = new Metamocha({ timeout: argv.t });

// Adding tests
argv._.forEach(function(file) {
  if (fs.lstatSync(file).isDirectory()) {
    metamocha.addFolderRec(file);
  } else {
    metamocha.addFile(file);
  }
});

// Skipping parameters
var startupOptions = {
  skipStartup: false,
  skipRestart: false,
  skipShutdown: false,
  skip: false
};

// Skipping parameters
if (argv.s) {
  startupOptions = {
    skipStartup: true,
    skipRestart: true,
    skipShutdown: true,
    skip: false
  };
}

// Configure mongod
var config;
if (argv.e === 'replicaset') {
  config = {
    host: 'localhost',
    port: 31000,
    setName: 'rs',
    topology: function(self, _mongo) {
      return new _mongo.ReplSet(
        [
          {
            host: 'localhost',
            port: 31000
          }
        ],
        { setName: 'rs' }
      );
    },
    manager: new ReplSetManager(
      'mongod',
      [
        {
          tags: { loc: 'ny' },
          // mongod process options
          options: {
            bind_ip: 'localhost',
            port: 31000,
            dbpath: f('%s/../db/31000', __dirname),
            setParameter: 'enableTestCommands=1'
          }
        },
        {
          tags: { loc: 'sf' },
          options: {
            bind_ip: 'localhost',
            port: 31001,
            dbpath: f('%s/../db/31001', __dirname),
            setParameter: 'enableTestCommands=1'
          }
        },
        {
          tags: { loc: 'sf' },
          priority: 0,
          options: {
            bind_ip: 'localhost',
            port: 31002,
            dbpath: f('%s/../db/31002', __dirname),
            setParameter: 'enableTestCommands=1'
          }
        },
        {
          tags: { loc: 'sf' },
          options: {
            bind_ip: 'localhost',
            port: 31003,
            dbpath: f('%s/../db/31003', __dirname),
            setParameter: 'enableTestCommands=1'
          }
        },
        {
          arbiter: true,
          options: {
            bind_ip: 'localhost',
            port: 31004,
            dbpath: f('%s/../db/31004', __dirname),
            setParameter: 'enableTestCommands=1'
          }
        }
      ],
      {
        replSet: 'rs'
      }
    )
  };
} else if (argv.e === 'sharded') {
  config = {
    host: 'localhost',
    port: 51000,
    skipStart: startupOptions.skipStartup,
    skipTermination: startupOptions.skipShutdown,
    topology: function(self, _mongo) {
      return new _mongo.Mongos([
        {
          host: 'localhost',
          port: 51000
        }
      ]);
    },
    manager: setupShardedCluster(new ShardingManager({}))
  };
} else if (argv.e === 'auth') {
  config = {
    host: 'localhost',
    port: 27017,
    skipStart: startupOptions.skipStartup,
    skipTermination: startupOptions.skipShutdown,
    manager: new ServerManager('mongod', {
      dbpath: path.join(path.resolve('db'), f('data-%d', 27017)),
      auth: null,
      setParameter: 'enableTestCommands=1'
    })
  };
} else {
  // Default
  config = {
    host: 'localhost',
    port: 27017,
    skipStart: startupOptions.skipStartup,
    skipTermination: startupOptions.skipShutdown,
    manager: new ServerManager('mongod', {
      dbpath: path.join(path.resolve('db'), f('data-%d', 27017)),
      setParameter: 'enableTestCommands=1'
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

// filters
metamocha.addFilter(new NodeVersionFilter());
metamocha.addFilter(new MongoDBTopologyFilter({ runtimeTopology: argv.e }));
metamocha.addFilter(new TravisFilter());
metamocha.addFilter(new ES6GeneratorsSupportedFilter());
metamocha.addFilter(new ES6PromisesSupportedFilter());

if (!argv.s) {
  metamocha.addFilter(new MongoDBVersionFilter());
}

// Download MongoDB and run tests
function start() {
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
}

if (argv.l) {
  start();
} else {
  m(function(err) {
    if (err) {
      console.dir(err);
      process.exit();
      return;
    }

    start();
  });
}
