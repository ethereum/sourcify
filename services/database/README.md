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
