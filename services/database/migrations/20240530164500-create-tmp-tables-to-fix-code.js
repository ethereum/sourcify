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
        `CREATE TABLE code_new
        (
            code_hash   bytea NOT NULL PRIMARY KEY,
            code    bytea
        );`
      ),
      db.runSql.bind(
        db,
        `CREATE TABLE contracts_new
        (
            id  uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
            creation_code_hash  bytea REFERENCES code_new (code_hash),
            runtime_code_hash   bytea NOT NULL REFERENCES code_new (code_hash),
            CONSTRAINT contracts_new_pseudo_pkey UNIQUE (creation_code_hash, runtime_code_hash)
        );
        
        CREATE INDEX contracts_new_creation_code_hash ON contracts_new USING btree(creation_code_hash);
        CREATE INDEX contracts_new_runtime_code_hash ON contracts_new USING btree(runtime_code_hash);
        CREATE INDEX contracts_new_creation_code_hash_runtime_code_hash ON contracts_new USING btree(creation_code_hash, runtime_code_hash);
        `
      ),
      db.runSql.bind(
        db,
        `CREATE TABLE compiled_contracts_new
        (
            id  uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at  timestamptz NOT NULL DEFAULT NOW(),
            updated_at  timestamptz NOT NULL DEFAULT NOW(),
            created_by  varchar NOT NULL DEFAULT (current_user),
            updated_by  varchar NOT NULL DEFAULT (current_user),
            compiler    VARCHAR NOT NULL,
            version     VARCHAR NOT NULL,
            language    VARCHAR NOT NULL,
            name    VARCHAR NOT NULL,
            fully_qualified_name    VARCHAR NOT NULL,
            sources                 jsonb NOT NULL,
            compiler_settings       jsonb NOT NULL,
            compilation_artifacts   jsonb NOT NULL,
            creation_code_hash      bytea REFERENCES code_new (code_hash),
            creation_code_artifacts jsonb,
            runtime_code_hash       bytea NOT NULL REFERENCES code_new (code_hash),
            runtime_code_artifacts  jsonb NOT NULL,
            CONSTRAINT compiled_contracts_new_pseudo_pkey UNIQUE (compiler, language, creation_code_hash, runtime_code_hash)
        );
        
        CREATE INDEX compiled_contracts_new_creation_code_hash ON compiled_contracts_new USING btree (creation_code_hash);
        CREATE INDEX compiled_contracts_new_runtime_code_hash ON compiled_contracts_new USING btree (runtime_code_hash);`
      ),
      db.runSql.bind(
        db,
        `CREATE OR REPLACE FUNCTION replicate_code_before_insert()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO code_new (code_hash, code)
            VALUES (NEW.code_hash, NEW.code) ON CONFLICT (code_hash) DO NOTHING;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
                
                
        CREATE TRIGGER before_insert_code_trigger_replicate
        BEFORE INSERT ON code
        FOR EACH ROW
        EXECUTE FUNCTION replicate_code_before_insert();`
      ),
      db.runSql.bind(
        db,
        `CREATE OR REPLACE FUNCTION replicate_compiled_contracts_after_insert()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO compiled_contracts_new (
              id,
              created_at,
              updated_at,
              created_by,
              updated_by,
              compiler,
              version,
              language,
              name,
              fully_qualified_name,
              sources,
              compiler_settings,
              compilation_artifacts,
              creation_code_hash,
              creation_code_artifacts,
              runtime_code_hash,
              runtime_code_artifacts
              )
            VALUES (
              NEW.id,
              NEW.created_at,
              NEW.updated_at,
              NEW.created_by,
              NEW.updated_by,
              NEW.compiler,
              NEW.version,
              NEW.language,
              NEW.name,
              NEW.fully_qualified_name,
              NEW.sources,
              NEW.compiler_settings,
              NEW.compilation_artifacts,
              NEW.creation_code_hash,
              NEW.creation_code_artifacts,
              NEW.runtime_code_hash,
              NEW.runtime_code_artifacts
            ) ON CONFLICT (compiler, language, creation_code_hash, runtime_code_hash) DO NOTHING;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
          
          CREATE TRIGGER after_insert_compiled_contracts_trigger_replicate
          AFTER INSERT ON compiled_contracts
          FOR EACH ROW
          EXECUTE FUNCTION replicate_compiled_contracts_after_insert();`
      ),
      db.runSql.bind(
        db,
        `CREATE OR REPLACE FUNCTION replicate_contracts_after_insert()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO contracts_new (
            id,
            creation_code_hash,
            runtime_code_hash
          )
            VALUES (
            NEW.id,
            NEW.creation_code_hash,
            NEW.runtime_code_hash
          )  ON CONFLICT (creation_code_hash, runtime_code_hash) DO NOTHING;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        
        CREATE TRIGGER after_insert_contracts_trigger_replicate
        AFTER INSERT ON contracts
        FOR EACH ROW
        EXECUTE FUNCTION replicate_contracts_after_insert();`
      ),
    ],
    callback
  );
};

exports.down = function (db, callback) {
  async.series(
    [
      db.dropTable.bind(db, "code_new"),
      db.dropTable.bind(db, "contracts_new"),
      db.dropTable.bind(db, "compiled_contracts_new"),
      db.runSql.bind(
        db,
        "DROP TRIGGER IF EXISTS before_insert_code_trigger_replicate ON code"
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "replicate_code_before_insert"'
      ),
      db.runSql.bind(
        db,
        "DROP TRIGGER IF EXISTS after_insert_compiled_contracts_trigger_replicate ON compiled_contracts"
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "replicate_compiled_contracts_after_insert"'
      ),
      db.runSql.bind(
        db,
        "DROP TRIGGER IF EXISTS after_insert_contracts_trigger_replicate ON contracts"
      ),
      db.runSql.bind(
        db,
        'DROP FUNCTION IF EXISTS "replicate_contracts_after_insert"'
      ),
    ],
    callback
  );
};
