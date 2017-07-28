/*jshint esversion: 6 */

var deepdif = require('deep-diff');
var rmdir = require('rmdir');
var Audit = require('../lib/audit');

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

  describe('#clearActionsOnMyEntities', function () {

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

    it('should not fail if there are no actions logged yet', function (done) {
      audit = new Audit(conf);
      audit.clearActionsOnMyEntities(user)
        .then(() => {
          done();
        }).catch((err) => {
          throw err;
        });
    });

    it('should remove only actions on entities owned by the user', function (done) {
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
          return audit.clearActionsOnMyEntities('alice!@!agile-local');
        }).then((actions) => {
          return Promise.all([
            audit.getActionsByOwner('alice!@!agile-local'),
            audit.getActionsByOwner('bob!@!agile-local')
          ]);
        }).then((array) => {
          //actions done on alice's entities are gone but actions on bob entities remain.
          if (array[0].length === 0 && array[1].length === 2) {
            done();
          }
        }).catch((err) => {
          throw err;
        });
    });

  });
});
