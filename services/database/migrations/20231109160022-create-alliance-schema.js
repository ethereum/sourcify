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
      // TODO: add date commit here once the alliance repo is public
      db.runSql.bind(
        db,
        `
      /* Needed for gen_random_uuid(); */
      CREATE EXTENSION pgcrypto;
      
      /*
          The \`code\` table stores a mapping from code hash to bytecode. This table may store
          both normalized and unnormalized code.
      
          Code is normalized when all libraries/immutable variables that are not constants are
          replaced with zeroes. In other words the variable \`address private immutable FACTORY = 0xAABB...EEFF;\`
          would not be replaced with zeroes, but the variable \`address private immutable OWNER = msg.sender\` would.
      
          The \`code\` column is not marked NOT NULL because we need to distinguish between
          empty code, and no code. Empty code occurs when a contract is deployed with no runtime code.
          No code occurs when a contract's code is written directly to the chain in a hard fork
      */
      CREATE TABLE code
      (
          /* the keccak256 hash of the \`code\` column */
          code_hash   bytea NOT NULL PRIMARY KEY,
      
          /* the bytecode */
          code    bytea
      );
      
      /* ensure the sentinel value exists */
      INSERT INTO code (code_hash, code) VALUES ('\\x', NULL);
      
      /*
          The \`contracts\` table stores information which can be used to identify a unique contract in a
          chain-agnostic manner. In other words, suppose you deploy the same contract on two chains, all
          properties that would be shared across the two chains should go in this table because they uniquely
          identify the contract.
      */
      CREATE TABLE contracts
      (
          /* an opaque id */
          id  uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      
          /*
              the creation code is the calldata (for eoa creations) or the instruction input (for create/create2)
              the runtime code is the bytecode that's returned by the creation code and stored on-chain
      
              neither fields are normalized
          */
          creation_code_hash  bytea NOT NULL REFERENCES code (code_hash),
          runtime_code_hash   bytea NOT NULL REFERENCES code (code_hash),
          
          CONSTRAINT contracts_pseudo_pkey UNIQUE (creation_code_hash, runtime_code_hash)
      );
      
      CREATE INDEX contracts_creation_code_hash ON contracts USING btree(creation_code_hash);
      CREATE INDEX contracts_runtime_code_hash ON contracts USING btree(runtime_code_hash);
      CREATE INDEX contracts_creation_code_hash_runtime_code_hash ON contracts USING btree(creation_code_hash, runtime_code_hash);
      
      /*
          The \`contract_deployments\` table stores information about a specific deployment unique to a chain.
          One contract address may have multiple deployments on a single chain if SELFDESTRUCT/CREATE2 is used
          The info stored in this table should be retrievable from an archive node. In other words, it should
          not be augmented with any inferred data
      */
      CREATE TABLE contract_deployments
      (
          /* an opaque id*/
          id  uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      
          /*
              these three fields uniquely identify a specific deployment of a contract, assuming
              that it is impossible to deploy to successfully an address twice in the same transaction
              (create2 -> selfdestruct -> create2 should revert on the second create2)
      
              in the case of a "genesis" contract, the transaction_hash should be set
              to keccak256(creation_code_hash || runtime_code_hash). this is because the transaction_hash
              needs to differ to distinguish between two versions of the same genesis contract, and so
              it needs to embed inside it the only feature that changes.
      
              also note that for genesis contracts, creation_code_hash may be '\\x' (i.e. there is no creation code)
          */
          chain_id            numeric NOT NULL,
          address             bytea NOT NULL,
          transaction_hash    bytea NOT NULL,
      
          /*
              geth full nodes have the ability to prune the transaction index, so if the transaction_hash
              can't be found directly, use the block_number and transaction_index. make sure to compare the transaction_hash to
              make sure it matches!
      
              for genesis contracts, both values should be set to -1
          */
          block_number        numeric NOT NULL,
          transaction_index   numeric NOT NULL,
          
          /*
              this is the address which actually deployed the contract (i.e. called the create/create2 opcode)
          */
          deployer    bytea NOT NULL,
      
          /* the contract itself */
          contract_id uuid NOT NULL REFERENCES contracts(id),
      
          CONSTRAINT contract_deployments_pseudo_pkey UNIQUE (chain_id, address, transaction_hash)
      );
      
      CREATE INDEX contract_deployments_contract_id ON contract_deployments USING btree(contract_id);
      
      /*
          The \`compiled_contracts\` table stores information about a specific compilation. A compilation is
          defined as a set of inputs (compiler settings, source code, etc) which uniquely correspond to a
          set of outputs (bytecode, documentation, ast, etc)
      */
      CREATE TABLE compiled_contracts
      (
          /* an opaque id */
          id  uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
          
          /* timestamps */
          created_at  timestamptz NOT NULL DEFAULT NOW(),
          updated_at  timestamptz NOT NULL DEFAULT NOW(),
      
          /* ownership */
          created_by  varchar NOT NULL DEFAULT (current_user),
          updated_by  varchar NOT NULL DEFAULT (current_user),
      
          /*
              these three fields uniquely identify the high-level compiler mode to use
      
              note that the compiler is the software ('solc', 'vyper', 'huff') while language is
              the syntax ('solidity', 'vyper', 'yul'). there may be future compilers which aren't solc
              but can still compile solidity, which is why we need to differentiate the two
      
              the version should uniquely identify the compiler
          */
          compiler    VARCHAR NOT NULL,
          version     VARCHAR NOT NULL,
          language    VARCHAR NOT NULL,
      
          /*
              the name is arbitrary and often not a factor in verifying contracts (solidity encodes it in
              the auxdata which we ignore, and vyper doesn't even have the concept of sourceunit-level names)
              because of this we don't include it in the unique constraint. it is stored purely for informational
              purposes
          */
          name    VARCHAR NOT NULL,
      
          /* the fully qualified name is compiler-specific and indicates exactly which contract to look for */
          fully_qualified_name    VARCHAR NOT NULL,
      
          /* map of path to source code (string => string) */
          sources                 jsonb NOT NULL,
      
          /* compiler-specific settings such as optimization, linking, etc (string => any) */
          compiler_settings       jsonb NOT NULL,
      
          /* general and compiler-specific artifacts (abi, userdoc, devdoc, licenses, etc) */
          compilation_artifacts   jsonb NOT NULL,
      
          /*
              note that we can't pull out creation/runtime code into its own table
              imagine that a future compiler and language combo result in the same bytecode
              this is something that we would want a record of, because the two sources are semantically
              unique
              in other words, the hypothetical table would need to be keyed on everything that this table already is
          */
      
          /* these fields store info about the creation code (sourcemaps, linkreferences) */
          creation_code_hash      bytea NOT NULL REFERENCES code (code_hash),
          creation_code_artifacts jsonb NOT NULL,
      
          /*
              these fields store info about the runtime code (sourcemaps, linkreferences, immutables)
              the runtime code should be normalized (i.e. immutables set to zero)
          */
          runtime_code_hash       bytea NOT NULL REFERENCES code (code_hash),
          runtime_code_artifacts  jsonb NOT NULL,
      
          /*
              two different compilers producing the same bytecode is unique enough that we want to preserve it
              the same compiler with two different versions producing the same bytecode is not unique (f.ex nightlies)
          */
          CONSTRAINT compiled_contracts_pseudo_pkey UNIQUE (compiler, language, creation_code_hash, runtime_code_hash)
      );
      
      CREATE INDEX compiled_contracts_creation_code_hash ON compiled_contracts USING btree (creation_code_hash);
      CREATE INDEX compiled_contracts_runtime_code_hash ON compiled_contracts USING btree (runtime_code_hash);
      
      /*
          The verified_contracts table links an on-chain contract with a compiled_contract
          Note that only one of creation or runtime bytecode must match, because:
              We could get a creation match but runtime mismatch if the contract is a proxy that uses assembly to return custom runtime bytecode
              We could get a runtime match but creation mismatch if the contract is deployed via a create2 factory
      */
      CREATE TABLE verified_contracts
      (
          /* an opaque id, but sequentially ordered */
          id  BIGSERIAL NOT NULL PRIMARY KEY,
          
          /* timestamps */
          created_at  timestamptz NOT NULL DEFAULT NOW(),
          updated_at  timestamptz NOT NULL DEFAULT NOW(),
      
          /* ownership */
          created_by  varchar NOT NULL DEFAULT (current_user),
          updated_by  varchar NOT NULL DEFAULT (current_user),
      
          /* the specific deployment and the specific compilation */
          deployment_id   uuid NOT NULL REFERENCES contract_deployments (id),
          compilation_id  uuid NOT NULL REFERENCES compiled_contracts (id),
      
          /*
              if the code matches, then the values and transformation fields contain
              all the information required to transform the compiled bytecode to the deployed bytecode
              see the json schemas provided for more information
          */
      
          creation_match              bool NOT NULL,
          creation_values             jsonb,
          creation_transformations    jsonb,
      
          runtime_match           bool NOT NULL,
          runtime_values          jsonb,
          runtime_transformations jsonb,
      
          CONSTRAINT verified_contracts_pseudo_pkey UNIQUE (compilation_id, deployment_id)
      );
      
      CREATE INDEX verified_contracts_deployment_id ON verified_contracts USING btree (deployment_id);
      CREATE INDEX verified_contracts_compilation_id ON verified_contracts USING btree (compilation_id);
      
      /* 
          Set up timestamps related triggers. Used to enforce \`created_at\` and \`updated_at\` 
          specific rules and prevent users to set those columns to invalid values.
          Spefically:
              \`created_at\` - should be set to the current timestamp on new row insertion,
                              and should not be modified after that.
              \`updated_at\` - should be set to the current timestamp on new row insertion,
                              and should be always be updated the corresponding value is modified.
      */
      
      /* Needed to automatically set \`created_at\` fields on insertions. */
      CREATE FUNCTION trigger_set_created_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.created_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      /*  Needed to prevent modifying \`crerated_at\` fields on updates */
      CREATE FUNCTION trigger_reuse_created_at()
          RETURNS TRIGGER AS
      $$
      BEGIN
          NEW.created_at = OLD.created_at;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      /* Needed to automatically set \`updated_at\` fields on insertions and updates */
      CREATE FUNCTION trigger_set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_by = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DO
      $$
          DECLARE
              t_name text;
          BEGIN
              FOR t_name IN (VALUES ('compiled_contracts'),
                                    ('verified_contracts'))
                  LOOP
                      EXECUTE format('CREATE TRIGGER insert_set_created_at
                              BEFORE INSERT ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_set_created_at()',
                                     t_name);
      
                      EXECUTE format('CREATE TRIGGER insert_set_updated_at
                              BEFORE INSERT ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_set_updated_at()',
                                     t_name);
      
                      EXECUTE format('CREATE TRIGGER update_reuse_created_at
                              BEFORE UPDATE ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_reuse_created_at()',
                                     t_name);
      
                      EXECUTE format('CREATE TRIGGER update_set_updated_at
                              BEFORE UPDATE ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_set_updated_at()',
                                     t_name);
                  END LOOP;
          END;
      $$ LANGUAGE plpgsql;
      
      /* 
          Set up ownership (who inserted the value) related triggers. 
          Used to enforce \`created_by\` and \`updated_by\` specific rules and prevent users to 
          set those columns to invalid values.
          Spefically:
              \`created_by\` - should be set to the current user on new row insertion,
                              and should not be modified after that.
              \`updated_by\` - should be set to the current user on new row insertion,
                              and should be always be updated the corresponding value is modified.
      */
      
      /* Needed to automatically set \`created_by\` fields on insertions. */
      CREATE FUNCTION trigger_set_created_by()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.created_by = current_user;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      /*  Needed to prevent modifying \`crerated_by\` fields on updates */
      CREATE FUNCTION trigger_reuse_created_by()
          RETURNS TRIGGER AS
      $$
      BEGIN
          NEW.created_by = OLD.created_by;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      /* Needed to automatically set \`updated_by\` fields on insertions and updates */
      CREATE FUNCTION trigger_set_updated_by()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_by = current_user;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      
      /* Set up ownership related triggers */
      DO
      $$
          DECLARE
              t_name text;
          BEGIN
              FOR t_name IN (VALUES ('compiled_contracts'),
                                    ('verified_contracts'))
                  LOOP
                      EXECUTE format('CREATE TRIGGER insert_set_created_by
                              BEFORE INSERT ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_set_created_by()',
                                     t_name);
      
                      EXECUTE format('CREATE TRIGGER insert_set_updated_by
                              BEFORE INSERT ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_set_updated_by()',
                                     t_name);
      
                      EXECUTE format('CREATE TRIGGER update_reuse_created_by
                              BEFORE UPDATE ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_reuse_created_by()',
                                     t_name);
      
                      EXECUTE format('CREATE TRIGGER update_set_updated_by
                              BEFORE UPDATE ON %I
                                  FOR EACH ROW
                              EXECUTE FUNCTION trigger_set_updated_by()',
                                     t_name);
                  END LOOP;
          END;
      $$ LANGUAGE plpgsql;      
      
      
      `
      ),
    ],
    callback
  );
};

exports.down = function (db, callback) {
  async.series(
    [
      db.dropTable.bind(db, "verified_contracts"),
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
      db.runSql.bind(db, 'DROP EXTENSION IF EXISTS "pgcrypto";'),
    ],
    callback
  );
};
