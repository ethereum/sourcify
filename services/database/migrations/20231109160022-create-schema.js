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
      db.runSql.bind(db, 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'),
      db.createTable.bind(db, "code", {
        code_hash: { type: "bytea", primaryKey: true },
        code: { type: "bytea", notNull: false },
        created_at: {
          type: "timestamptz",
          notNull: true,
          defaultValue: new String("NOW()"),
        },
      }),
      db.runSql.bind(
        db,
        "INSERT INTO code (code_hash, code) VALUES ('\\x', NULL);"
      ),
      db.createTable.bind(db, "contracts", {
        id: {
          type: "uuid",
          notNull: true,
          defaultValue: new String("gen_random_uuid()"),
        },
        creation_code_hash: {
          type: "bytea",
          notNull: true,
          foreignKey: {
            name: "contracts_creation_code_hash_fk",
            table: "code",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "code_hash",
          },
        },
        runtime_code_hash: {
          type: "bytea",
          notNull: true,
          foreignKey: {
            name: "contracts_runtime_code_hash_fk",
            table: "code",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "code_hash",
          },
        },
        created_at: {
          type: "timestamptz",
          notNull: true,
          defaultValue: new String("NOW()"),
        },
      }),
      db.runSql.bind(db, "ALTER TABLE contracts ADD PRIMARY KEY (id)"),
      db.addIndex.bind(db, "contracts", "contracts_creation_code_hash_idx", [
        "creation_code_hash",
      ]),
      db.addIndex.bind(db, "contracts", "contracts_runtime_code_hash_idx", [
        "runtime_code_hash",
      ]),
      db.runSql.bind(
        db,
        "ALTER TABLE contracts ADD CONSTRAINT contracts_pseudo_pkey UNIQUE (creation_code_hash, runtime_code_hash)"
      ),
      db.createTable.bind(db, "contract_deployments", {
        id: {
          type: "uuid",
          notNull: true,
          defaultValue: new String("gen_random_uuid()"),
        },
        chain_id: { type: "numeric", notNull: true },
        address: { type: "bytea", notNull: true },
        transaction_hash: { type: "bytea", notNull: true },
        block_number: "numeric",
        txindex: "numeric",
        deployer: "bytea",
        contract_id: {
          type: "uuid",
          notNull: true,
          foreignKey: {
            name: "contract_deployments_contract_id_fk",
            table: "contracts",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "id",
          },
        },
        created_at: {
          type: "timestamptz",
          notNull: true,
          defaultValue: new String("NOW()"),
        },
      }),
      db.runSql.bind(
        db,
        "ALTER TABLE contract_deployments ADD PRIMARY KEY (id);"
      ),
      db.addIndex.bind(
        db,
        "contract_deployments",
        "contract_deployments_contract_id_idx",
        ["contract_id"]
      ),
      db.runSql.bind(
        db,
        "ALTER TABLE contract_deployments ADD CONSTRAINT contract_deployments_pseudo_pkey UNIQUE (chain_id, address, transaction_hash)"
      ),
      db.createTable.bind(db, "compiled_contracts", {
        id: {
          type: "uuid",
          notNull: true,
          defaultValue: new String("gen_random_uuid()"),
        },
        compiler: { type: "string", notNull: true },
        version: { type: "string", notNull: true },
        language: { type: "string", notNull: true },
        name: { type: "string", notNull: true },
        fully_qualified_name: { type: "string", notNull: true },
        sources: { type: "jsonb", notNull: true },
        compiler_settings: { type: "jsonb", notNull: true },
        compilation_artifacts: { type: "jsonb", notNull: true },
        creation_code_hash: {
          type: "bytea",
          notNull: true,
          foreignKey: {
            name: "compiled_contracts_creation_code_hash_fk",
            table: "code",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "code_hash",
          },
        },
        creation_code_artifacts: { type: "jsonb", notNull: true },
        runtime_code_hash: {
          type: "bytea",
          notNull: true,
          foreignKey: {
            name: "compiled_contracts_runtime_code_hash_fk",
            table: "code",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "code_hash",
          },
        },
        runtime_code_artifacts: { type: "jsonb", notNull: true },
        created_at: {
          type: "timestamptz",
          notNull: true,
          defaultValue: new String("NOW()"),
        },
      }),
      db.runSql.bind(
        db,
        "ALTER TABLE compiled_contracts ADD PRIMARY KEY (id);"
      ),
      db.addIndex.bind(
        db,
        "compiled_contracts",
        "compiled_contracts_creation_code_hash_idx",
        ["creation_code_hash"]
      ),
      db.addIndex.bind(
        db,
        "compiled_contracts",
        "compiled_contracts_runtime_code_hash_idx",
        ["runtime_code_hash"]
      ),
      db.runSql.bind(
        db,
        "ALTER TABLE compiled_contracts ADD CONSTRAINT compiled_contracts_pseudo_pkey UNIQUE (compiler, language, creation_code_hash, runtime_code_hash)"
      ),
      db.createTable.bind(db, "verified_contracts", {
        id: {
          type: "uuid",
          notNull: true,
          defaultValue: new String("gen_random_uuid()"),
        },
        compilation_id: {
          type: "uuid",
          notNull: true,
          foreignKey: {
            name: "verified_contracts_compilation_id_fk",
            table: "compiled_contracts",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "id",
          },
        },
        contract_id: {
          type: "uuid",
          notNull: true,
          foreignKey: {
            name: "verified_contracts_contract_id_fk",
            table: "contracts",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "id",
          },
        },
        creation_match: { type: "boolean", notNull: true },
        creation_values: "jsonb",
        creation_transformations: "jsonb",
        runtime_match: { type: "boolean", notNull: true },
        runtime_values: "jsonb",
        runtime_transformations: "jsonb",
        created_at: {
          type: "timestamptz",
          notNull: true,
          defaultValue: new String("NOW()"),
        },
      }),
      db.runSql.bind(
        db,
        "ALTER TABLE verified_contracts ADD PRIMARY KEY (id);"
      ),
      db.addIndex.bind(
        db,
        "verified_contracts",
        "verified_contracts_contract_id_idx",
        ["contract_id"]
      ),
      db.addIndex.bind(
        db,
        "verified_contracts",
        "verified_contracts_compilation_id_idx",
        ["compilation_id"]
      ),
      db.runSql.bind(
        db,
        "ALTER TABLE verified_contracts ADD CONSTRAINT verified_contracts_pseudo_pkey UNIQUE (compilation_id, contract_id)"
      ),
      db.createTable.bind(db, "sourcify_matches", {
        id: {
          type: "uuid",
          notNull: true,
          defaultValue: new String("gen_random_uuid()"),
        },
        verified_contract_id: {
          type: "uuid",
          notNull: true,
          foreignKey: {
            name: "sourcify_matches_verified_contract_id_fk",
            table: "verified_contracts",
            rules: {
              onDelete: "RESTRICT",
              onUpdate: "RESTRICT",
            },
            mapping: "id",
          },
        },
        creation_match: { type: "varchar", notNull: false },
        runtime_match: { type: "varchar", notNull: false },
        created_at: {
          type: "timestamptz",
          notNull: true,
          defaultValue: new String("NOW()"),
        },
      }),
      db.runSql.bind(db, "ALTER TABLE sourcify_matches ADD PRIMARY KEY (id);"),
      db.addIndex.bind(
        db,
        "sourcify_matches",
        "sourcify_matches_verified_contract_id_idx",
        ["verified_contract_id"]
      ),
      db.runSql.bind(
        db,
        "ALTER TABLE sourcify_matches ADD CONSTRAINT sourcify_matches_pseudo_pkey UNIQUE (verified_contract_id)"
      ),
      db.createTable.bind(db, "sourcify_sync", {
        id: {
          type: "uuid",
          notNull: true,
          defaultValue: new String("gen_random_uuid()"),
        },
        chain_id: { type: "numeric", notNull: true },
        address: { type: "bytea", notNull: true },
        match_type: { type: "varchar", notNull: true },
        synced: { type: "boolean", notNull: true, defaultValue: false },
        created_at: {
          type: "timestamptz",
          notNull: true,
          defaultValue: new String("NOW()"),
        },
      }),
      db.runSql.bind(db, "ALTER TABLE sourcify_sync ADD PRIMARY KEY (id);"),
      db.runSql.bind(
        db,
        "ALTER TABLE sourcify_sync ADD CONSTRAINT sourcify_sync_pseudo_pkey UNIQUE (chain_id,address)"
      ),
    ],
    callback
  );
};

exports.down = function (db, callback) {
  async.series(
    [
      db.dropTable.bind(db, "sourcify_sync"),
      db.dropTable.bind(db, "sourcify_matches"),
      db.dropTable.bind(db, "verified_contracts"),
      db.dropTable.bind(db, "compiled_contracts"),
      db.dropTable.bind(db, "contract_deployments"),
      db.dropTable.bind(db, "contracts"),
      db.dropTable.bind(db, "code"),
      db.runSql.bind(db, 'DROP EXTENSION IF EXISTS "pgcrypto";'),
    ],
    callback
  );
};
