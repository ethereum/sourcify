"use strict";

const fs = require("fs");
var async = require("async");

var dbm;
var type;
var seed;

const allianceSchemaSql = fs.readFileSync(
  "./database-specs/database.sql",
  "utf8",
);

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
  async.series([db.runSql.bind(db, allianceSchemaSql)], callback);
};

exports.down = function (db, callback) {
  async.series(
    [
      db.dropTable.bind(db, "verified_contracts"),
      db.dropTable.bind(db, "compiled_contracts_sources"),
      db.dropTable.bind(db, "sources"),
      db.dropTable.bind(db, "compiled_contracts"),
      db.dropTable.bind(db, "contract_deployments"),
      db.dropTable.bind(db, "contracts"),
      db.dropTable.bind(db, "code"),

      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "trigger_set_created_at";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "trigger_reuse_created_at";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "trigger_set_updated_at";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "trigger_set_created_by";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "trigger_reuse_created_by";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "trigger_set_updated_by";'),

      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_runtime_transformations";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_creation_transformations";',
      ),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "validate_transformations";'),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformations_call_protection";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformations_cbor_auxdata";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformations_immutable";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformations_library";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformations_constructor_arguments";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformation_key_id";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformation_key_offset";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_transformation_key_type";',
      ),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "validate_runtime_values";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "validate_creation_values";'),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_values_call_protection";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_values_cbor_auxdata";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_values_immutables";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_values_libraries";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_values_constructor_arguments";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_runtime_code_artifacts";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_creation_code_artifacts";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_compilation_artifacts";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_compilation_artifacts_sources";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_compilation_artifacts_sources_internal";',
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "validate_json_object_keys";',
      ),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "is_valid_hex";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "is_jsonb_null";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "is_jsonb_number";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "is_jsonb_array";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "is_jsonb_string";'),
      db.runSql.bind(db, 'DROP FUNCTION IF EXISTS "is_jsonb_object";'),
      db.runSql.bind(db, 'DROP EXTENSION IF EXISTS "pgcrypto";'),
    ],
    callback,
  );
};
