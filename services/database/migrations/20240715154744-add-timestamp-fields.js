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
        `CREATE OR REPLACE FUNCTION trigger_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;`,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE code
        ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW(),
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW(),
        ADD COLUMN created_by varchar NOT NULL DEFAULT (current_user),
        ADD COLUMN updated_by varchar NOT NULL DEFAULT (current_user);
        
        ALTER TABLE contracts
        ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW(),
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW(),
        ADD COLUMN created_by varchar NOT NULL DEFAULT (current_user),
        ADD COLUMN updated_by varchar NOT NULL DEFAULT (current_user);
        
        ALTER TABLE contract_deployments
        ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW(),
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW(),
        ADD COLUMN created_by varchar NOT NULL DEFAULT (current_user),
        ADD COLUMN updated_by varchar NOT NULL DEFAULT (current_user);`,
      ),
      db.runSql.bind(
        db,
        `DO
        $$
            DECLARE
                t_name text;
            BEGIN
                FOR t_name IN (VALUES 
                              ('code'),
                              ('contracts'),
                              ('contract_deployments'))
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
        
        DO
        $$
          DECLARE
              t_name text;
          BEGIN
                FOR t_name IN (VALUES 
                    ('code'),
                    ('contracts'),
                    ('contract_deployments'))
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
        `CREATE OR REPLACE FUNCTION trigger_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_by = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;`,
      ),
      db.runSql.bind(
        db,
        `ALTER TABLE code
        DROP COLUMN created_at,
        DROP COLUMN updated_at,
        DROP COLUMN created_by,
        DROP COLUMN updated_by;
        
        ALTER TABLE contracts
        DROP COLUMN created_at,
        DROP COLUMN updated_at,
        DROP COLUMN created_by,
        DROP COLUMN updated_by;
        
        ALTER TABLE contract_deployments
        DROP COLUMN created_at,
        DROP COLUMN updated_at,
        DROP COLUMN created_by,
        DROP COLUMN updated_by;`,
      ),
    ],
    callback,
  );
};

exports._meta = {
  version: 1,
};
