## before

- Run `npm run migrate:up` on the staging database
- Run `npm run migrate:up` on the production database (adds `created_at` to `compiled_contracts_metadata` without a table rewrite; the index build blocks inserts into the table for a short time)
