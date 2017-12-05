#!/usr/bin/env node

'use strict';
var path = require('path'),
  f = require('util').format,
  fs = require('fs'),
  m = require('mongodb-version-manager'),
  Metamocha = require('metamocha').Metamocha,
  ServerManager = require('mongodb-topology-manager').Server,
  NodeVersionFilter = require('./filters/node_version_filter'),
  MongoDBVersionFilter = require('./filters/mongodb_version_filter'),
  MongoDBTopologyFilter = require('./filters/mongodb_topology_filter'),
  ES6PromisesSupportedFilter = require('./filters/es6_promises_supported_filter'),
  ES6GeneratorsSupportedFilter = require('./filters/es6_generators_supported_filter'),
  TravisFilter = require('./filters/travis_filter');

var argv = require('yargs')
  .usage('Usage: $0 -l -s -t [timeout] -e [environment] [files]')
  .help()
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
        'Skips the MongoDB environment setup. Used when a local MongoDB instance is preferred over the one created by the test runner',
      type: 'boolean'
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
    },
    g: {
      alias: 'grep',
      describe: 'only run tests matching <pattern>',
      type: 'string'
    }
  }).argv;

var mochaOptions = {};
if (!!argv.t) mochaOptions.timeout = argv.t;
if (!!argv.g) mochaOptions.grep = argv.g;

var metamocha = new Metamocha(mochaOptions);

// Add tests
argv._.forEach(function(file) {
  metamocha.lookupFiles(file);
});

// Add filters
metamocha.addFilter(new NodeVersionFilter());
metamocha.addFilter(new MongoDBTopologyFilter({ runtimeTopology: argv.e }));
metamocha.addFilter(new TravisFilter());
metamocha.addFilter(new ES6GeneratorsSupportedFilter());
metamocha.addFilter(new ES6PromisesSupportedFilter());
metamocha.addFilter(new MongoDBVersionFilter());

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

var testPath = path.join(process.cwd(), 'test');
var configPath = path.join(testPath, 'config.js');
var envPath = path.join(testPath, 'environments.js');

if (!fs.existsSync(envPath)) {
  console.warn('Project must provide an environments configuration file');
  process.exit(1);
  return;
}

if (!fs.existsSync(configPath)) {
  console.warn('Project must provide a test configuration file');
  process.exit(1);
  return;
}

var environments = require(envPath);
if (!environments.hasOwnProperty(argv.e)) {
  console.warn('Invalid environment specified: ' + argv.e);
  process.exit(1);
  return;
}

var Environment = environments[argv.e];
var TestConfiguration = require(configPath);

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

// Download MongoDB and run tests
function start() {
  var versionCheckManager = new ServerManager();
  return versionCheckManager.discover().then(function(serverInfo) {
    var environment = new Environment(serverInfo);
    var mongoPackage = findMongo(path.dirname(module.filename));

    try {
      environment.mongo = require(mongoPackage.path);
    } catch (err) {
      throw new Error('The test runner must be a dependency of mongodb or mongodb-core');
    }

    // patch environment based on skip info
    if (startupOptions.skipStartup) environment.skipStart = true;
    if (startupOptions.skipShutdown) environment.skipTermination = true;

    var dbConfig = new TestConfiguration(environment);
    dbConfig.start(function(err) {
      if (err) {
        console.dir(err);
        process.exit(1);
      }

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
  });
}

if (argv.l) {
  start();
  return;
}

m(function(err) {
  if (err) {
    console.dir(err);
    process.exit();
    return;
  }

  start();
});
