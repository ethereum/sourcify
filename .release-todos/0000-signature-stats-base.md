## before

- Create the public bucket for the base files, if it does not exist (see issue #3022).
- Create the BigQuery scheduled query `signature-stats-base-production` from `services/4byte/bigquery/signature-stats-base.sql` (dataset `sourcify-project.sourcify`, ENV `production`). Run it once, and check that `gs://<bucket>/signature-stats/production-000000000000.json` has the counts.
- Send the failure notifications of the scheduled query to the team.
- Check that the database user `sourcify-4byte` can read the tables that `/recent` uses. On the production database:
  ```sql
  SELECT t, has_table_privilege('sourcify-4byte', t, 'SELECT')
  FROM unnest(array['verified_contracts', 'contract_deployments', 'compiled_contracts']) t;
  ```
  If one is `false`, run `GRANT SELECT ON <table> TO "sourcify-4byte";`.

## after

- Set `SIGNATURE_STATS_BASE_URL=https://storage.googleapis.com/<bucket>/signature-stats/production-000000000000.json` on the Cloud Run service `sourcify-production-4byte`. Check that `GET https://api.4byte.sourcify.dev/signature-database/v1/stats` gives numbers, not `null`.
- Run `npm run migrate:up` on the production database. Do this after the new 4byte service is deployed, because the old service reads the view that the migration drops.
- Check that the cron job is gone: `SELECT jobid, jobname FROM cron.job;` must not list `refresh-signature-stats`. If it is still there, `cron.unschedule` ran as a different user than the owner of the job. Then run `SELECT cron.unschedule('refresh-signature-stats');` as the owner.
