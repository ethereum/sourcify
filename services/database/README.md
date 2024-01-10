# Sourcify Database

The Sourcify Database is a postgres database using `db-migrate` to update its schema.

## Getting started

- Copy paste `.env.template` in `.env` and set the variables.
- Run `docker-compose up`
- Run `npm run migrate:up` to update the database to the latest version

## Reset the database

- Run `npm run migrate:reset` to reverse all the executed migrations

## Creating a change to the schema with migrations

- Run `npm run migrate:create` to create a new database migration, a new file under `migrations/` will appear, use that file to alter the database.

# Synchronization process

The synchronization process takes two steps, in the first one we are going to store all the contracts from the repov1 into `sourcify_sync`, a table used to keep track of the to-be-synced contracts. In the second step we are using the `sourcify_sync` table to re-verify all the contracts on a new sourcify instance marking every successful synced contract into `sourcify_sync` as `synced`.

> **Note**
> Use `npm run sourcify:database --  --help` for a full list of options and parameters

## 1. Import the repository in the `sourcify_sync` table

```
npm run sourcify:database import-repo /Users/marcocastignoli/Projects/repository/contracts
```

## 2. Start synchronization from `sourcify_sync` to a Sourcify instance

```
npm run sourcify:database sync https://sourcify.dev/server /Users/marcocastignoli/Projects/repository --  -c 0 -l 2
```
