"use strict";

var async = require("async");

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db, callback) {
  async.series(
    [
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts ALTER COLUMN runtime_metadata_match DROP NOT NULL;`,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts ALTER COLUMN creation_metadata_match DROP NOT NULL;`,
      ),
    ],
    callback,
  );
};

exports.down = function (db, callback) {
  async.series(
    [
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts ALTER COLUMN runtime_metadata_match SET NOT NULL;`,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts ALTER COLUMN creation_metadata_match SET NOT NULL;`,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
