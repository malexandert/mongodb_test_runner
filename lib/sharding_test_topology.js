var f = require('util').format;

// MongoDB Topology Manager
var setupShardedCluster = function(manager) {
  manager.addShard(
    [
      {
        options: {
          bind_ip: 'localhost', port: 31000, dbpath: f('%s/../db/31000', __dirname)
        }
      }, {
        options: {
          bind_ip: 'localhost', port: 31001, dbpath: f('%s/../db/31001', __dirname)
        }
      }, {
        // Type of node
        arbiter: true,
        // mongod process options
        options: {
          bind_ip: 'localhost', port: 31002, dbpath: f('%s/../db/31002', __dirname)
        }
      }
    ],
    {
      replSet: 'rs1'
    }
  ).then(function() {
    // Add one shard
    manager.addShard([{
      options: {
        bind_ip: 'localhost', port: 31010, dbpath: f('%s/../db/31010', __dirname)
      }
    }, {
      options: {
        bind_ip: 'localhost', port: 31011, dbpath: f('%s/../db/31011', __dirname)
      }
    }, {
      // Type of node
      arbiter: true,
      // mongod process options
      options: {
        bind_ip: 'localhost', port: 31012, dbpath: f('%s/../db/31012', __dirname)
      }
    }], {
      replSet: 'rs2'
    }).then(function() {
      // Add configuration servers
      manager.addConfigurationServers([{
        options: {
          bind_ip: 'localhost', port: 35000, dbpath: f('%s/../db/35000', __dirname)
        }
      }, {
        options: {
          bind_ip: 'localhost', port: 35001, dbpath: f('%s/../db/35001', __dirname)
        }
      }, {
        options: {
          bind_ip: 'localhost', port: 35002, dbpath: f('%s/../db/35002', __dirname)
        }
      }], {
        replSet: 'rs3'
      }).then(function() {
        // Add proxies
        manager.addProxies([{
          bind_ip: 'localhost', port: 51000, configdb: 'localhost:35000,localhost:35001,localhost:35002'
        }, {
          bind_ip: 'localhost', port: 51001, configdb: 'localhost:35000,localhost:35001,localhost:35002'
        }], {
          binary: 'mongos'
        });
      });
    });
  });

  return manager;
};

module.exports = {
  setupShardedCluster: setupShardedCluster
};
