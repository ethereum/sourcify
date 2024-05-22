# Sourcify -> Verifier Alliance sync

This script is needed to push all verified_contracts from one Sourcify to VerA database. VerA is a live database in which other entities are writing while the script is running.

## Configure

1. Copy and paste `.env.template` to `.env` and fill it appropriately.

## Run

`npm run vera:push`

## How it works

0. CURRENT_VERIFIED_CONTRACT is a variable stored in a permanent file, default 1.
1. Extract N verified_contracts starting from CURRENT_VERIFIED_CONTRACT
2. For each verified_contract:
   a. Update the CURRENT_VERIFIED_CONTRACT counter
   b. Get all information from verified_contracts
   c. Get all the FK information
   d. Insert all the verified_contracts dependencies (compiled_contracts,contract_deployments,contracts,code) and verified_contracts using the new ids as FKs

# Verifier Alliance -> Sourcify sync

This daemon listens for `new_verified_contract` PostgreSQL notification and sends requests to sourcify-server.

## Configuration

1. Run the following SQL queries on the Verifier Alliance database to set up the notification.

   ```sql
   CREATE OR REPLACE FUNCTION notify_new_verified_contract()
   RETURNS TRIGGER AS $$
   BEGIN
      PERFORM pg_notify('new_verified_contract', row_to_json(NEW)::text);
      RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;


   CREATE TRIGGER new_verified_contract_trigger
   AFTER INSERT ON verified_contracts
   FOR EACH ROW
   EXECUTE FUNCTION notify_new_verified_contract();
   ```

2. Copy-paste `.env.template` to `.env` and fill it appropriately.

## Run

`npm run vera:pull`
