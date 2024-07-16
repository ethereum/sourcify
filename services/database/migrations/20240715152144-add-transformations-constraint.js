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
        `ALTER TABLE verified_contracts 

        ADD CONSTRAINT verified_contracts_creation_values_is_object
            CHECK (creation_values IS NULL OR jsonb_typeof(creation_values) = 'object'),
        ADD CONSTRAINT verified_contracts_creation_transformations_is_array
            CHECK (creation_transformations IS NULL OR jsonb_typeof(creation_transformations) = 'array'),
    
        ADD CONSTRAINT verified_contracts_runtime_values_is_object
            CHECK (runtime_values IS NULL OR jsonb_typeof(runtime_values) = 'object'),
        ADD CONSTRAINT verified_contracts_runtime_transformations_is_array
            CHECK (runtime_transformations IS NULL OR jsonb_typeof(runtime_transformations) = 'array'),
    
        ADD CONSTRAINT verified_contracts_match_exists 
            CHECK (creation_match = true OR runtime_match = true),
        ADD CONSTRAINT verified_contracts_creation_match_integrity
            CHECK ((creation_match = false AND creation_values IS NULL AND creation_transformations IS NULL) OR
                   (creation_match = true AND creation_values IS NOT NULL AND creation_transformations IS NOT NULL)),
        ADD CONSTRAINT verified_contracts_runtime_match_integrity
            CHECK ((runtime_match = false AND runtime_values IS NULL AND runtime_transformations IS NULL) OR
                   (runtime_match = true AND runtime_values IS NOT NULL AND runtime_transformations IS NOT NULL));
        `,
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
        `ALTER TABLE verified_contracts 
        DROP CONSTRAINT IF EXISTS verified_contracts_creation_values_is_object,
        DROP CONSTRAINT IF EXISTS verified_contracts_creation_transformations_is_array,
        DROP CONSTRAINT IF EXISTS verified_contracts_runtime_values_is_object,
        DROP CONSTRAINT IF EXISTS verified_contracts_runtime_transformations_is_array,
        DROP CONSTRAINT IF EXISTS verified_contracts_match_exists,
        DROP CONSTRAINT IF EXISTS verified_contracts_creation_match_integrity,
        DROP CONSTRAINT IF EXISTS verified_contracts_runtime_match_integrity;
        `,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
