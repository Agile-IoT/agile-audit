/*jshint esversion: 6 */

var deepdif = require('deep-diff');
var rmdir = require('rmdir');
var Audit = require('../lib/audit');
var conf = require('./default-conf');

var user = {
  id: 'agile!@!agile-local',
  client_id: 'someClient'
};

var entity = {
  id: '1',
  type: '/sensor',
  owner: 'bob!@!agile-local'
};

describe('AgileAudit', function () {

  describe('#getActions', function () {

    afterEach(function (done) {
      rmdir(conf.dbName + '_audit', function (err, dirs, files) {
        if (err) {
          throw err;
        } else {
          audit.close().then(() => {
            done();
          });
        }
      });
    });

    it('should return an empty array if nothing has been inserted', function (done) {

      audit = new Audit(conf);
      audit.getActions()
        .then((ac) => {
          if (ac.length === 0) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

    it('should return action after insert', function (done) {

      audit = new Audit(conf);
      audit.log(1, user, entity, 'read')
        .then(() => {
          return audit.getActions();
        }).then((actions) => {
          var ac = actions.filter((act) => {
            return act.action === 'read' && act.user === user.id;
          });
          if (ac.length === 1) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

    it('should return actions sorted by time', function (done) {

      audit = new Audit(conf);
      audit.log(1, user, entity, 'read')
        .then(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve();
            }, 300);
          });
        }).then(() => {
          return audit.log(1, user, entity, 'write');
        }).then(() => {
          return audit.getActions();
        }).then((actions) => {
          if (actions[0].action === 'write') {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

    it('should cleanup log entries older than configured timeframe', function (done) {

      audit = new Audit(conf);
      Promise.all([
        audit.log(1, user, entity, 'read1', null, new Date().getTime() - (1000 * 3600 * 25)),
        audit.log(1, user, entity, 'read2', null, new Date().getTime() - (1000 * 3600 * 23)),
        audit.log(1, user, entity, 'read3', null, new Date().getTime() - (1000 * 3600 * 26))
      ]).then(() => {
        return audit.getActions();
      }).then((actions) => {
        if (actions.length === 1) {
          done();
        }
      }).catch((err) => {
        throw err;
      });
    });

  });

  describe('#getActionsByEntityIdAndType', function () {

    afterEach(function (done) {

      rmdir(conf.dbName + '_audit', function (err, dirs, files) {
        if (err) {
          throw err;
        } else {
          audit.close().then(() => {
            done();
          });
        }
      });
    });

    it('should return actions for an entity with id an type matching the arguments', function (done) {

      audit = new Audit(conf);
      var entity2 = {
        id: '3',
        type: '/sensor',
        owner: 'alice!@!agile-local'
      };
      Promise.all([
          audit.log(1, user, entity, 'read'),
          audit.log(1, user, entity2, 'read'),
          audit.log(1, user, entity, 'write'),
          audit.log(1, user, entity2, 'write'),
        ])
        .then(() => {
          return audit.getActionsByEntityIdAndType('3', '/sensor');
        }).then((actions) => {
          var owned = actions.reduce((sum, v) => {
            return sum && v.entity.id === '3' && v.entity.type === '/sensor';
          }, true);
          if (actions.length === 2 && owned) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

  });

  describe('#getActionsByOwner', function () {

    afterEach(function (done) {

      rmdir(conf.dbName + '_audit', function (err, dirs, files) {
        if (err) {
          throw err;
        } else {
          audit.close().then(() => {
            done();
          });
        }
      });
    });

    it('should return actions for every entity owned by the user passed as argument', function (done) {

      audit = new Audit(conf);
      var entity2 = {
        id: '3',
        type: '/sensor',
        owner: 'alice!@!agile-local'
      };
      Promise.all([
          audit.log(1, user, entity, 'read'),
          audit.log(1, user, entity2, 'read'),
          audit.log(1, user, entity, 'write'),
          audit.log(1, user, entity2, 'write'),
        ])
        .then(() => {
          return audit.getActionsByOwner('alice!@!agile-local');
        }).then((actions) => {
          var owned = actions.reduce((sum, v) => {
            return sum && v.entity.owner === 'alice!@!agile-local';
          }, true);
          if (actions.length === 2 && owned) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

  });

  describe('#getActionsByMe', function () {

    afterEach(function (done) {

      rmdir(conf.dbName + '_audit', function (err, dirs, files) {
        if (err) {
          throw err;
        } else {
          audit.close().then(() => {
            done();
          });
        }
      });
    });

    it('should return actions for exectued on behalf of the user passed as argument', function (done) {

      audit = new Audit(conf);
      var user2 = {
        id: 'bob!@!agile-local',
        client_id: 'someClient'
      };
      Promise.all([
          audit.log(1, user, entity, 'read'),
          audit.log(1, user2, entity, 'read'),
          audit.log(1, user, entity, 'write'),
          audit.log(1, user2, entity, 'write'),
        ])
        .then(() => {
          return audit.getActionsByMe('bob!@!agile-local');
        }).then((actions) => {
          var owned = actions.reduce((sum, v) => {
            return sum && v.user === 'bob!@!agile-local';
          }, true);
          if (actions.length === 2 && owned) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

  });
});
