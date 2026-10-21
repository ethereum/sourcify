Signature stats from a daily BigQuery base (issue #3022, live 4byte signature stats).

Already done on 2026-10-20 and 2026-10-21, on production and staging:

- The private bucket `gs://sourcify-signature-stats`, and read access to it for `sourcify-production-4byte@` and `sourcify-staging-4byte@`.
- The service account `signature-stats-base@` with its access rights.
- The daily scheduled queries `signature-stats-base-production` and `signature-stats-base-staging`. Each has a Cloud Monitoring alert for failed runs, because the failure emails of BigQuery go to the service account.
- `GRANT SELECT ON verified_contracts, contract_deployments, compiled_contracts TO "sourcify-4byte";` for `/recent`.
- Staging only: the nightly job `refresh-signature-stats` was unscheduled by hand, and the stream `sourcify-staging-pg-bq-stream` was created again.

## before

Do these on staging after the merge to `staging`, if they are not done yet:

- Set `SIGNATURE_STATS_BASE_URL=gs://sourcify-signature-stats/staging-000000000000.json` and `SIGNATURE_STATS_BASE_MAX_AGE_HOURS=720` on `sourcify-staging-4byte`. Staging can go 2 weeks without a new signature, so its base is often older than the default of 48 hours.
- Run `npm run migrate:up` on the staging database. The new staging 4byte service must be deployed first, because the old service reads the view that the migration drops.

## after

- Set `SIGNATURE_STATS_BASE_URL=gs://sourcify-signature-stats/production-000000000000.json` on the Cloud Run service `sourcify-production-4byte`. Check that `GET https://api.4byte.sourcify.dev/signature-database/v1/stats` gives numbers, not `null`.
- Run `npm run migrate:up` on the production database. Do this after the new 4byte service is deployed, because the old service reads the view that the migration drops.
- Check that the cron job is gone: `SELECT jobid, jobname FROM cron.job;` must not list `refresh-signature-stats`. If it is still there, `cron.unschedule` ran as a different user than the owner of the job. Then run `SELECT cron.unschedule('refresh-signature-stats');` as the owner.
