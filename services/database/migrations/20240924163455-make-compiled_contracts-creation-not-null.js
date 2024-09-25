// Constraints for the `compiled_contracts` table, according to the Verifier Alliance schema https://github.com/verifier-alliance/database-specs/pull/12
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
        `ALTER TABLE compiled_contracts DROP CONSTRAINT compiled_contracts_pseudo_pkey;
        ALTER TABLE compiled_contracts ADD CONSTRAINT compiled_contracts_pseudo_pkey UNIQUE (compiler, language, creation_code_hash, runtime_code_hash);
        ALTER TABLE compiled_contracts ALTER COLUMN creation_code_artifacts SET NOT NULL;
        ALTER TABLE compiled_contracts ALTER COLUMN creation_code_hash SET NOT NULL;`,
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
        `ALTER TABLE compiled_contracts ALTER COLUMN creation_code_hash DROP NOT NULL;
        ALTER TABLE compiled_contracts ALTER COLUMN creation_code_artifacts DROP NOT NULL;
        ALTER TABLE compiled_contracts DROP CONSTRAINT compiled_contracts_pseudo_pkey;
        ALTER TABLE compiled_contracts ADD CONSTRAINT compiled_contracts_pseudo_pkey UNIQUE NULLS NOT DISTINCT (compiler, language, creation_code_hash, runtime_code_hash);`,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
