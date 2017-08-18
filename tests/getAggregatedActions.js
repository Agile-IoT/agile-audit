/*jshint esversion: 6 */

var deepdif = require('deep-diff');
var rmdir = require('rmdir');
var Audit = require('../lib/audit');
var deepdif = require('deep-diff');

var conf = {
  dbName: './leveldb',
  defaults: {
    //according to https://www.npmjs.com/package/timeframe-to-seconds,
    timeframe: '1d',
    //DETAILED=0, ONLY_IMPORTANT_STUFF=1
    level: 1
  }

};

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

  describe('#aggregateActions', function () {

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

    it('should return an empty object if some non-existing entity is queried', function (done) {

      audit = new Audit(conf);
      audit.aggregateActionsEntityByUser('1', '/sensor')
        .then((ac) => {
          if (Object.keys(ac).length === 0) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

    it('should return actions for an entity with id an type matching the arguments', function (done) {

      audit = new Audit(conf);
      var user2 = {
        id: 'bob!@!agile-local',
        client_id: 'someClient2'
      };
      Promise.all([
          audit.log(1, user, entity, 'read'),
          audit.log(1, user2, entity, 'read'),
          audit.log(1, user, entity, 'write'),
          audit.log(1, user2, entity, 'read'),
          audit.log(1, user2, entity, 'write'),
        ])
        .then(() => {
          return audit.aggregateActionsEntityByUser('1', '/sensor');
        }).then((actions) => {
          var result = {};
          result[user2.id] = {
            "read": {
              "count": 2
            },
            "write": {
              "count": 1
            }
          };
          result[user.id] = {
            "read": {
              "count": 1
            },
            "write": {
              "count": 1
            }
          };

          if (deepdif(actions, result) === undefined) {
            done();
          } else {
            console.log("expected actions: " + JSON.stringify(result));
            console.log("got actions: " + JSON.stringify(actions));
          }
          /*var owned = actions.reduce((sum, v) => {
            return sum && v.entity.id === '3' && v.entity.type === '/sensor';
          }, true);
          if (actions.length === 2 && owned) {
            done();

          }*/

        }).catch((err) => {
          throw err;
        });
    });

  });

});
