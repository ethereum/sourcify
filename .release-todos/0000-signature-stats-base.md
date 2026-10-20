Signature stats from a daily BigQuery base (issue #3022, live 4byte signature stats).

Already done on 2026-10-20: the private bucket `gs://sourcify-signature-stats`, the service account `signature-stats-base@` with its access rights, read access to the bucket for `sourcify-production-4byte@` and `sourcify-staging-4byte@`, and the daily scheduled query `signature-stats-base-production`. On staging, the nightly job `refresh-signature-stats` was unscheduled by hand, and the stream `sourcify-staging-pg-bq-stream` was created again.

## before

- Let the database user `sourcify-4byte` read the tables that `/recent` uses, on production and on staging. As an admin user:
  ```sql
  GRANT SELECT ON verified_contracts, contract_deployments, compiled_contracts TO "sourcify-4byte";
  ```
- Check that a Cloud Monitoring alert exists for failed runs of `signature-stats-base-production`. The failure emails of BigQuery go to the service account, so nobody reads them.

## after

- Set `SIGNATURE_STATS_BASE_URL=gs://sourcify-signature-stats/production-000000000000.json` on the Cloud Run service `sourcify-production-4byte`. Check that `GET https://api.4byte.sourcify.dev/signature-database/v1/stats` gives numbers, not `null`.
- Run `npm run migrate:up` on the production database. Do this after the new 4byte service is deployed, because the old service reads the view that the migration drops.
- Check that the cron job is gone: `SELECT jobid, jobname FROM cron.job;` must not list `refresh-signature-stats`. If it is still there, `cron.unschedule` ran as a different user than the owner of the job. Then run `SELECT cron.unschedule('refresh-signature-stats');` as the owner.
