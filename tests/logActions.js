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

  describe('#logAction', function () {

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

    it('should log only values equal to level set in the config or higher', function (done) {

      audit = new Audit(conf);
      audit.log(1, user, entity, 'read')
        .then(() => {
          return audit.getActions();
        }).then((actions) => {
          if (actions.length === 1) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

    it('should NOT log only values lower to level set in the config', function (done) {

      audit = new Audit(conf);
      audit.log(0, user, entity, 'read')
        .then(() => {
          return audit.getActions();
        }).then((actions) => {
          //since we have 1, level 0 should not be logged
          if (actions.length === 0) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

    it('should only log actions matching regex if provided during configuration', function (done) {
      var conf2 = {
        dbName: './leveldb',
        //according to https://www.npmjs.com/package/timeframe-to-seconds,
        timeframe: '1d',
        //DETAILED=0, ONLY_IMPORTANT_STUFF=1
        level: 1,
        regex: '^actions'
        //regex in case we want to log only certain
      };
      audit = new Audit(conf2);

      var user2 = {
        id: 'bob!@!agile-local',
        client_id: 'someClient2'
      };
      Promise.all([
          audit.log(1, user, entity, 'actions.read'),
          audit.log(1, user2, entity, 'actions.read'),
          audit.log(1, user, entity, 'write'),
          audit.log(1, user2, entity, 'read'),
          audit.log(1, user2, entity, 'write'),
        ])
        .then(() => {
          return audit.getActions();
        }).then((actions) => {

          var actionsStart = actions.reduce((sum, v) => {
            return sum && v.action.indexOf('actions') === 0;
          }, true);
          if (actionsStart && actions.length === 2) {
            done();
          }

        }).catch((err) => {
          throw err;
        });
    });

  });

});
