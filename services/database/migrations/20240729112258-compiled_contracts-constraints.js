// Constraints for the `compiled_contracts` table, according to the Verifier Alliance schema https://github.com/verifier-alliance/database-specs/pull/12
"use strict";

var async = require("async");

var dbm;

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
        CREATE OR REPLACE FUNCTION validate_json_object_keys(obj jsonb, mandatory_keys text[], optional_keys text[])
            RETURNS boolean AS
        $$
        BEGIN
            RETURN
                (jsonb_typeof(obj) = 'object') AND
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
            RETURN validate_json_object_keys(obj, mandatory_keys, array []::text[]);
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION validate_compilation_artifacts(obj jsonb)
            RETURNS boolean AS
        $$
        BEGIN
            RETURN validate_json_object_keys(obj, array ['abi', 'userdoc', 'devdoc', 'sources', 'storageLayout']);
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION validate_creation_code_artifacts(obj jsonb)
            RETURNS boolean AS
        $$
        BEGIN
            RETURN validate_json_object_keys(obj, array ['sourceMap', 'linkReferences'], array ['cborAuxdata']);
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION validate_runtime_code_artifacts(obj jsonb)
            RETURNS boolean AS
        $$
        BEGIN
            RETURN validate_json_object_keys(obj, array ['sourceMap', 'linkReferences', 'immutableReferences'],
                                            array ['cborAuxdata']);
        END;
        $$ LANGUAGE plpgsql;

        ALTER TABLE compiled_contracts DROP CONSTRAINT compiled_contracts_pseudo_pkey;

        ALTER TABLE compiled_contracts
        ADD CONSTRAINT compiled_contracts_pseudo_pkey UNIQUE (compiler, language, creation_code_hash, runtime_code_hash),
        ADD CONSTRAINT compilation_artifacts_object CHECK (validate_compilation_artifacts(compilation_artifacts)),
        ADD CONSTRAINT creation_code_artifacts_object CHECK (validate_creation_code_artifacts(creation_code_artifacts)),
        ADD CONSTRAINT runtime_code_artifacts_object CHECK (validate_runtime_code_artifacts(runtime_code_artifacts));
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

        DROP FUNCTION IF EXISTS validate_json_object_keys;
        DROP FUNCTION IF EXISTS validate_json_object_keys;
        DROP FUNCTION IF EXISTS validate_compilation_artifacts;
        DROP FUNCTION IF EXISTS validate_creation_code_artifacts;
        DROP FUNCTION IF EXISTS validate_runtime_code_artifacts;
        `,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
