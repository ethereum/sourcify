# Sourcify Database

`sourcify-database` contains the database migrations for the PostgreSQL using `db-migrate` to update its schema.

Sourcify's database is an extension of the [Verifier Alliance](https://verifieralliance.org) database with some modifications. The modifications are specified in the [20231109160023-sourcify.js](./migrations/20231109160023-sourcify.js) migration. In short, Sourcify allows contract verification without the creation bytecode and creation information such as the creation transaction hash. In addition, a table `sourcify_matches` is created to store the match type (full vs. partial) and the contract metadata in the database.

The migrations can be run to set up the Sourcify database.

## Running the migrations

- Copy paste `.env.template` in `.env` and set the variables.
- Run `npm run migrate:up` to update the database to the latest version. This will run the `dev` config in [database.json](./database.json) with `localhost`. To run the migrations in production with `POSTGRES_HOST` use `npm run migrate:up -- --env production`

For convenience, you can run the Postgres container in `docker-compose.yml` with `docker-compose up`.

## Reset the database

- Run `npm run migrate:reset` to reverse all the executed migrations

## Creating a change to the schema with migrations

- Run `npm run migrate:create` to create a new database migration, a new file under `migrations/` will appear, use that file to alter the database.

# Migrating from the legacy repository (RepositoryV1) to the database

Following v2.0.0, Sourcify no longer uses the filesystem as its source of truth. To switch from the legacy repository to the new database, contracts need to be re-compiled and verified with a new Sourcify instance.

## Synchronization process

The synchronization process takes two steps, in the first one we are going to store all the contracts from the repov1 into `sourcify_sync`, a table used to keep track of the to-be-synced contracts. In the second step we are using the `sourcify_sync` table to re-verify all the contracts on a new sourcify instance marking every successful synced contract into `sourcify_sync` as `synced`.

> **Note**
> Use `npm run sourcify:database --  --help` for a full list of options and parameters

## 1. Import the repository in the `sourcify_sync` table

```
npm run sourcify:database import-repo /home/app/repository/contracts
```

## 2. Start synchronization from `sourcify_sync` to a Sourcify instance

```
npm run sourcify:database sync https://sourcify.dev/server /home/app/repository/contracts --  --chains 1,5,11155111 --limit 2 --start-from <timestamp> --until <timestamp>
```
