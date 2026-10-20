## before

- Create the private bucket `gs://sourcify-signature-stats` (europe-west1, uniform access, public access prevention on), for issue #3022 (live 4byte signature stats).
- Let the service account `signature-stats-base@` run BigQuery jobs, read the datasets `sourcify` and `sourcify_staging`, and write to the bucket. Let `sourcify-production-4byte@` and `sourcify-staging-4byte@` read the bucket.
- Create the BigQuery scheduled query `signature-stats-base-production` from `services/4byte/bigquery/signature-stats-base.sql`: dataset `sourcify-project.sourcify`, ENV `production`, every hour, as `signature-stats-base@`. Turn on the failure notifications. Run it once, and check that `gs://sourcify-signature-stats/production-000000000000.json` has the counts.
- Let the database user `sourcify-4byte` read the tables that `/recent` uses. On 2026-10-20 it could not read them. On the production database, as an admin user:
  ```sql
  GRANT SELECT ON verified_contracts, contract_deployments, compiled_contracts TO "sourcify-4byte";
  ```

## after

- Set `SIGNATURE_STATS_BASE_URL=gs://sourcify-signature-stats/production-000000000000.json` on the Cloud Run service `sourcify-production-4byte`. Check that `GET https://api.4byte.sourcify.dev/signature-database/v1/stats` gives numbers, not `null`.
- Run `npm run migrate:up` on the production database. Do this after the new 4byte service is deployed, because the old service reads the view that the migration drops.
- Check that the cron job is gone: `SELECT jobid, jobname FROM cron.job;` must not list `refresh-signature-stats`. If it is still there, `cron.unschedule` ran as a different user than the owner of the job. Then run `SELECT cron.unschedule('refresh-signature-stats');` as the owner.
