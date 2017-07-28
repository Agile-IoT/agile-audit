/*jshint esversion: 6 */

var level = require('level');
var createError = require('http-errors');
var fs = require('fs');
var db;
var timeframeToSeconds = require('timeframe-to-seconds');

function Audit(props) {
  this.dbName = props.dbName;
  this.defaults = Object.assign({}, props.defaults);

}

Audit.prototype.init = function () {
  var that = this;
  return new Promise((resolve, reject) => {
    if (db) {
      resolve();
    } else {
      var options = {
        keyEncoding: 'string',
        valueEncoding: 'json'
      };

      db = level(that.dbName + "_audit", options, function (err, db) {
        if (err) {
          reject(createError(500, "unexpected error" + err));
        } else {
          fs.readFile(that.dbName + '_config.json', function (err, value) {
            if (err) {
              Object.assign(that, that.defaults);
            } else {
              Object.assign(that, JSON.parse(value.toString()));
            }
            resolve();
          });
        }
      });
    }
  });

};

Audit.prototype.close = function () {
  var that = this;
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((error) => {
        if (error) {
          reject(createError('cannot close audit db' + error));
        } else {
          db = undefined;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};

Audit.prototype.log = function (level, user, entity, action, actionArgs, t) {

  var that = this;
  return new Promise(function (resolve, reject) {
    that.init()
      .then(() => {
        if (level < that.level) {
          resolve();
        } else {
          try {
            var ev = {
              user: user.id,
              client: user.client_id,
              entity: {
                id: entity.id,
                type: entity.type,
                owner: entity.owner
              },
              action: action,
              time: t || new Date().getTime()
            };
            if (actionArgs && actionArgs != null) {
              ev.args = actionArgs;
            }
            var id = `${user.id}-${entity.id}-${entity.type}-${ev.time}-${Math.floor((Math.random() * 1000) + 1)}`;
            db.put(id, ev, function (error) {
              if (error) {
                reject(createError(500, 'unexpected error while logging event ' + error));
              } else {
                resolve();
              }
            });
          } catch (e) {
            reject(createError(500, 'unexpected error while logging event ' + e));
          }
        }
      });
  });
};

Audit.prototype.getActionsWithFilters = function (filterRead, filterDelete) {

  var that = this;
  return new Promise((resolve, reject) => {
    var events = [];
    that.init()
      .then(() => {
        db.createReadStream()
          .on('data', function (data) {
            if (filterDelete) {
              if (filterDelete(data.value)) {
                db.del(data.key);
                return;
              }
            }
            if (filterRead) {
              if (filterRead(data.value)) {
                events.push(data.value);
              }
            }

          })
          .on('error', function (err) {
            reject(createError(500, 'cannot read values from audit ' + err));
          })
          .on('close', function () {
            events = events.sort((a, b) => {
              return b.time - a.time;
            });
            resolve(events);
          });
      }).catch(err => {
        reject(createError(500, err));
      });
  });
};

Audit.prototype.getActions = function () {
  var that = this;
  return this.getActionsWithFilters(function filterAdd(v) {
    return true;
  }, function filterDelete(v) {
    var t = new Date().getTime();
    return (t - v.time > timeframeToSeconds(that.timeframe) * 1000);
  });
};

Audit.prototype.getActionsByOwner = function (owner) {
  return this.getActionsWithFilters((v) => {
    return v.entity.owner === owner;
  });
};

Audit.prototype.getActionsByMe = function (user) {
  return this.getActionsWithFilters((v) => {
    return v.user === user;
  });
};

Audit.prototype.clearActionsOnMyEntities = function (user) {
  return this.getActionsWithFilters(() => {
    return false;
  }, (v) => {
    return v.entity.owner === user;
  });
};
module.exports = Audit;
