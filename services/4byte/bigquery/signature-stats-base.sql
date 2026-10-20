-- "Base" counts for GET /signature-database/v1/stats.
--
-- Run as a BigQuery scheduled query every hour, one for each environment.
-- Before you create the scheduled query, replace:
--   DATASET  the Datastream mirror of the database: `sourcify-project.sourcify`
--            (production) or `sourcify-project.sourcify_staging` (staging)
--   BUCKET   the bucket of the 4byte frontend: 4bytes-sourcify (production) or
--            4bytes-sourcify-staging (staging). The file is then also at
--            https://4byte.sourcify.dev/signature-stats/ENV-000000000000.json
--   ENV      production or staging
--
-- The 4byte service accepts a base with a t0 of at most 6 hours ago, because
-- the Postgres delta query gets slow for long windows.
--
-- The 4byte service reads the file (SIGNATURE_STATS_BASE_URL) and adds the
-- Postgres rows with created_at > t0. The counts use the same rules as the old
-- signature_stats materialized view.
--
-- t0 comes from the newest mirrored row, not from the clock. So if the
-- Datastream stream stops, t0 does not move forward and the Postgres delta
-- covers the outage. One hour of margin lets rows that commit late (created_at
-- is the transaction start time) reach the mirror.

DECLARE newest_signature TIMESTAMP DEFAULT (
  SELECT MAX(created_at) FROM `DATASET.public_signatures`
);
DECLARE newest_usage TIMESTAMP DEFAULT (
  SELECT MAX(created_at) FROM `DATASET.public_compiled_contracts_signatures`
);
DECLARE t0 TIMESTAMP DEFAULT TIMESTAMP_SUB(LEAST(newest_signature, newest_usage), INTERVAL 1 HOUR);

-- New signatures arrive every hour. If the mirror is more than 3 hours behind,
-- the stream is broken: fail, so that the scheduled query sends an alert and
-- the old file ages into the fallback of the 4byte service.
IF newest_signature IS NULL OR newest_usage IS NULL
  OR LEAST(newest_signature, newest_usage) < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 HOUR) THEN
  RAISE USING MESSAGE = FORMAT(
    'Mirror is stale: newest signature %t, newest usage %t', newest_signature, newest_usage);
END IF;

EXPORT DATA OPTIONS (
  uri = 'gs://BUCKET/signature-stats/ENV-*.json',
  format = 'JSON',
  overwrite = true
) AS
WITH
  -- The mirror is append-only, so a deleted row stays as an INSERT row plus a
  -- DELETE row.
  deleted_signatures AS (
    SELECT DISTINCT signature_hash_32
    FROM `DATASET.public_signatures`
    WHERE datastream_metadata.change_type = 'DELETE'
  ),
  deleted_usages AS (
    SELECT DISTINCT id
    FROM `DATASET.public_compiled_contracts_signatures`
    WHERE datastream_metadata.change_type = 'DELETE'
  ),
  signatures AS (
    SELECT DISTINCT signature_hash_32
    FROM `DATASET.public_signatures`
    WHERE datastream_metadata.change_type = 'INSERT'
      AND created_at <= t0
      AND signature_hash_32 NOT IN (SELECT signature_hash_32 FROM deleted_signatures)
  ),
  usages AS (
    SELECT DISTINCT signature_hash_32, signature_type
    FROM `DATASET.public_compiled_contracts_signatures`
    WHERE datastream_metadata.change_type = 'INSERT'
      AND created_at <= t0
      AND id NOT IN (SELECT id FROM deleted_usages)
  )
SELECT
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', t0) AS t0,
  (SELECT COUNTIF(signature_type = 'function') FROM usages JOIN signatures USING (signature_hash_32)) AS function,
  (SELECT COUNTIF(signature_type = 'event') FROM usages JOIN signatures USING (signature_hash_32)) AS event,
  (SELECT COUNTIF(signature_type = 'error') FROM usages JOIN signatures USING (signature_hash_32)) AS error,
  (SELECT COUNT(*) FROM signatures
    WHERE signature_hash_32 NOT IN (SELECT signature_hash_32 FROM usages)) AS unknown,
  (SELECT COUNT(*) FROM signatures) AS total;
