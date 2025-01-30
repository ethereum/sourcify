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
        `
        CREATE OR REPLACE FUNCTION is_object(obj jsonb)
            RETURNS boolean AS
        $$
        BEGIN
            RETURN
                jsonb_typeof(obj) = 'object';
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION validate_json_object_keys(obj jsonb, mandatory_keys text[], optional_keys text[])
            RETURNS boolean AS
        $$
        BEGIN
            RETURN
                -- ensures that all keys on the right exist as keys inside obj
                obj ?& mandatory_keys AND
                -- check that no unknown key exists inside obj
                bool_and(obj_keys = any (mandatory_keys || optional_keys))
                from (select obj_keys from jsonb_object_keys(obj) as obj_keys) as subquery;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION validate_json_object_keys(obj jsonb, mandatory_keys text[])
            RETURNS boolean AS
        $$
        BEGIN
            RETURN is_object(obj) AND validate_json_object_keys(obj, mandatory_keys, array []::text[]);
        END;
        $$ LANGUAGE plpgsql;

        ALTER TABLE compiled_contracts DROP CONSTRAINT compiled_contracts_pseudo_pkey;

        ALTER TABLE compiled_contracts
        ADD CONSTRAINT compiled_contracts_pseudo_pkey UNIQUE (compiler, language, creation_code_hash, runtime_code_hash);
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
        `
        ALTER TABLE compiled_contracts DROP CONSTRAINT compiled_contracts_pseudo_pkey;
        
        ALTER TABLE compiled_contracts
        ADD CONSTRAINT compiled_contracts_pseudo_pkey UNIQUE (compiler, language, creation_code_hash, runtime_code_hash);

        ALTER TABLE compiled_contracts
        DROP CONSTRAINT IF EXISTS compilation_artifacts_object,
        DROP CONSTRAINT IF EXISTS creation_code_artifacts_object,
        DROP CONSTRAINT IF EXISTS runtime_code_artifacts_object;

        DROP FUNCTION IF EXISTS validate_json_object_keys(jsonb, text[], text[]);
        DROP FUNCTION IF EXISTS validate_json_object_keys(jsonb, text[]);
        `,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
