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
        `ALTER TABLE code ADD COLUMN code_hash_keccak bytea DEFAULT '\\x';`,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE code ALTER COLUMN code_hash_keccak SET NOT NULL;`,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE code ADD CONSTRAINT code_hash_check CHECK (code IS NOT NULL AND code_hash = digest(code, 'sha3-256') OR code IS NULL AND code_hash = '\\x'::bytea);`,
      ),
      db.runSql.bind(
        db,
        `CREATE INDEX code_code_hash_keccak ON code USING btree(code_hash_keccak);`,
      ),
    ],
    callback,
  );
};

exports.down = function (db, callback) {
  async.series(
    [
      db.runSql.bind(db, `DROP INDEX IF EXISTS code_code_hash_keccak;`),
      db.runSql.bind(
        db,
        `ALTER TABLE code DROP CONSTRAINT IF EXISTS code_hash_check;`,
      ),
      db.runSql.bind(db, `ALTER TABLE code DROP COLUMN code_hash_keccak;`),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
