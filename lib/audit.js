/*jshint esversion: 6 */

var level = require('level');
var createError = require('http-errors');
var fs = require('fs');
var db;
var timeframeToSeconds = require('timeframe-to-seconds');

//this filter cleans up old records in the db
function filterCleanUp(v) {
  var t = new Date().getTime();
  return (t - v.time > timeframeToSeconds(this.timeframe) * 1000);
}

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

Audit.prototype.countActionsByUser = function (filterRead, filterDelete) {

  var that = this;
  return new Promise((resolve, reject) => {
    var events = {};
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
                events[data.value.user] = events[data.value.user] || {};
                events[data.value.user] = events[data.value.user] || {};
                events[data.value.user][data.value.action] = events[data.value.user][data.value.action] || {
                  count: 0
                };
                events[data.value.user][data.value.action].count++;
              }
            }
          })
          .on('error', function (err) {
            reject(createError(500, 'cannot read values from audit ' + err));
          })
          .on('close', function () {
            resolve(events);
          });
      }).catch(err => {
        reject(createError(500, err));
      });
  });
};

Audit.prototype.getActions = function () {
  return this.getActionsWithFilters((v) => {
    return true;
  }, filterCleanUp.bind(this));
};

Audit.prototype.getActionsByOwner = function (owner) {
  return this.getActionsWithFilters((v) => {
    return v.entity.owner === owner;
  }, filterCleanUp.bind(this));
};

Audit.prototype.getActionsByEntityIdAndType = function (id, type) {
  return this.getActionsWithFilters((v) => {
    return v.entity.id === id && v.entity.type === type;
  }, filterCleanUp.bind(this));
};

Audit.prototype.getActionsByMe = function (user) {
  return this.getActionsWithFilters((v) => {
    return v.user === user;
  }, filterCleanUp.bind(this));
};

Audit.prototype.clearActionsOnMyEntities = function (user) {
  return this.getActionsWithFilters(() => {
    return false;
  }, (v) => {
    return v.entity.owner === user;
  });
};

Audit.prototype.aggregateActionsEntityByUser = function (id, type) {
  return this.countActionsByUser((v) => {
    return v.entity.id === id && v.entity.type === type;
  }, filterCleanUp.bind(this));
};

module.exports = Audit;
