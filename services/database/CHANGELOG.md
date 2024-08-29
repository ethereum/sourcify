# Changelog for `sourcify-database`

## sourcify-database@1.3.0 - 2024-08-29

- Added constraints for `compiled_contracts` table in migrations
- Updated the script:
  - Added `single-sync` command to send one contract
  - Added `import-creator-tx` to import all contracts with a creator-tx-hash.txt file. Needed for contracts that failed to verify with creation tx durign the sync
  - Refactor some parts
  - Change deprecated chains sync code

## sourcify-database@1.2.0 - 2024-07-25

- Update README on how to run the migrations
- add prod. env to the database migrations
- Add new migrations to accomodate the changes in the VerA database
- Update dependencies
- Update the script's import-repo command to insert the contracts read from the FS to the Database in batches instead of one-by-one


## sourcify-database@1.1.1 - 2024-05-14

- bump version

## sourcify-database@1.1.0 - 2024-04-23

- Add session table to migrations 

## sourcify-database@1.0.3 - 2024-04-04

- Add schema to support postgresql based session (commented)

## sourcify-database@1.0.2 - 2024-03-14

- Fix `fsevents` to the `optionalDependencies` for Linux builds.

## sourcify-database@1.0.1 - 2024-02-26

- Fix migration scripts

## sourcify-database@1.0.0 - 2024-02-22

- Initial commit
