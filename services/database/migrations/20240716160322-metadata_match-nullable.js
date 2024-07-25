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
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts 
        DROP CONSTRAINT IF EXISTS verified_contracts_creation_match_integrity,
        DROP CONSTRAINT IF EXISTS verified_contracts_runtime_match_integrity;
        `,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts 
        ADD CONSTRAINT verified_contracts_creation_match_integrity
            CHECK ((creation_match = false AND creation_values IS NULL AND creation_transformations IS NULL AND creation_metadata_match IS NULL) OR
                   (creation_match = true AND creation_values IS NOT NULL AND creation_transformations IS NOT NULL AND creation_metadata_match IS NOT NULL)),
        ADD CONSTRAINT verified_contracts_runtime_match_integrity
            CHECK ((runtime_match = false AND runtime_values IS NULL AND runtime_transformations IS NULL AND runtime_metadata_match IS NULL) OR
                   (runtime_match = true AND runtime_values IS NOT NULL AND runtime_transformations IS NOT NULL AND runtime_metadata_match IS NOT NULL));`,
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
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts 
        DROP CONSTRAINT IF EXISTS verified_contracts_creation_match_integrity,
        DROP CONSTRAINT IF EXISTS verified_contracts_runtime_match_integrity;
        `,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE verified_contracts 
        ADD CONSTRAINT verified_contracts_creation_match_integrity
            CHECK ((creation_match = false AND creation_values IS NULL AND creation_transformations IS NULL) OR
                   (creation_match = true AND creation_values IS NOT NULL AND creation_transformations IS NOT NULL)),
        ADD CONSTRAINT verified_contracts_runtime_match_integrity
            CHECK ((runtime_match = false AND runtime_values IS NULL AND runtime_transformations IS NULL) OR
                   (runtime_match = true AND runtime_values IS NOT NULL AND runtime_transformations IS NOT NULL));`,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
