## before

- Make sure that the release workflow of `sourcifyeth/4byte.sourcify.dev` keeps the `signature-stats/` folder when it clears the bucket (issue #3022).
- Create the BigQuery scheduled query `signature-stats-base-production` from `services/4byte/bigquery/signature-stats-base.sql`: dataset `sourcify-project.sourcify`, bucket `4bytes-sourcify`, ENV `production`, every hour, as the service account `signature-stats-base@`. Run it once, and check that `https://4byte.sourcify.dev/signature-stats/production-000000000000.json` has the counts.
- Turn on the failure notifications of the scheduled query.
- Let the database user `sourcify-4byte` read the tables that `/recent` uses. On 2026-10-20 it could not read them. On the production database, as an admin user:
  ```sql
  GRANT SELECT ON verified_contracts, contract_deployments, compiled_contracts TO "sourcify-4byte";
  ```

## after

- Set `SIGNATURE_STATS_BASE_URL=https://4byte.sourcify.dev/signature-stats/production-000000000000.json` on the Cloud Run service `sourcify-production-4byte`. Check that `GET https://api.4byte.sourcify.dev/signature-database/v1/stats` gives numbers, not `null`.
- Run `npm run migrate:up` on the production database. Do this after the new 4byte service is deployed, because the old service reads the view that the migration drops.
- Check that the cron job is gone: `SELECT jobid, jobname FROM cron.job;` must not list `refresh-signature-stats`. If it is still there, `cron.unschedule` ran as a different user than the owner of the job. Then run `SELECT cron.unschedule('refresh-signature-stats');` as the owner.
