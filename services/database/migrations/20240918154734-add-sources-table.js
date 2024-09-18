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
          CREATE TABLE sources
          (
              /* the sha256 hash of the source code */
              source_hash bytea NOT NULL PRIMARY KEY,

              /* the keccak256 hash of the source code */
              source_hash_keccak bytea NOT NULL,

              /* the actual source code content */
              content varchar NOT NULL,

              /* timestamps */
              created_at  timestamptz NOT NULL DEFAULT NOW(),
              updated_at  timestamptz NOT NULL DEFAULT NOW(),

              /* ownership */
              created_by  varchar NOT NULL DEFAULT (current_user),
              updated_by  varchar NOT NULL DEFAULT (current_user),

              CONSTRAINT source_hash_check CHECK (source_hash = digest(content, 'sha256'))
          );

          CREATE TABLE compiled_contracts_sources
          (
              id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),

              /* the specific compilation and the specific source */
              compilation_id uuid NOT NULL REFERENCES compiled_contracts(id),
              source_hash bytea NOT NULL REFERENCES sources(source_hash),

              /* the file path associated with this source code in the compilation */
              path varchar NOT NULL,

              CONSTRAINT compiled_contracts_sources_pseudo_pkey UNIQUE (compilation_id, path)
          );

          CREATE INDEX compiled_contracts_sources_source_hash ON compiled_contracts_sources USING btree (source_hash);
          CREATE INDEX compiled_contracts_sources_compilation_id ON compiled_contracts_sources (compilation_id);

          -- ALTER TABLE compiled_contracts DROP COLUMN sources;
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
      DROP TABLE compiled_contracts_sources;
      DROP TABLE sources;
    `,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
