# Sourcify 4byte Service

A standalone service for serving Ethereum function, event, and error signatures. Makes use of Sourcify's verified contracts database's signature collection (See [Sourcify Database](https://github.com/argotorg/sourcify/tree/master/services/database)).

The API is backwards compatible with the [openchain.xyz](https://openchain.xyz/) API.

## Overview

## Features

- **Signature Lookup**: Find signatures by their 4-byte or 32-byte hashes e.g. `0xa9059cbb`
- **Signature Search**: Search signatures by text patterns e.g. `transfer(address,uint256)`
- **Statistics**: Get signature counts and metadata
- **Multi-type Support**: Functions, events, and error signatures
- **Filtering**: Optional filtering for canonical signatures

## API Endpoints

Refer to the [OpenAPI specification](./src/openapi.yaml) for the API endpoints and their usage.

The docs are available at runtime at `/api-docs` as a Swagger UI website.

## Development

### Prerequisites

- Node.js 22
- PostgreSQL database with Sourcify schema (See [Sourcify Database](https://github.com/argotorg/sourcify/tree/master/services/database))

### Setup

```bash
# Install dependencies
npm install

# Build the service
npm run build

# Run tests
npm run test-local

# Start development server
npm run dev
```

### Environment Variables

Check out the `.env.example` file for the required environment variables.

### Signature stats

`GET /signature-database/v1/stats` does not count all signatures in Postgres, because a count by type reads all rows of `compiled_contracts_signatures`. Instead:

1. Every hour, a BigQuery scheduled query ([`bigquery/signature-stats-base.sql`](./bigquery/signature-stats-base.sql)) counts all signatures with `created_at <= t0` in the BigQuery mirror of the database. It writes the counts to a JSON file in the private bucket `sourcify-signature-stats`.
2. The service reads the file from `SIGNATURE_STATS_BASE_URL` at start and every 10 minutes. For a `gs://bucket/object` URL, it reads the file as the service account of the Cloud Run service (a token from the metadata server). An `https://` URL is read without authentication.
3. For each request, it adds the signatures with `created_at > t0` from Postgres. It caches the result for 5 seconds.

If the service has no file, or `t0` is 6 hours old or more, the `function`, `event`, `error` and `unknown` counts are `null`. `total` is then a full count in Postgres, done once a day, plus the new signatures. The delta query gets slow for long windows (about 8 seconds for one day on production), so the service does not use an older base.

## Docker

### Build

```bash
# From project root
docker build -f services/4byte/Dockerfile -t sourcify-4byte .
```

### Run

```bash
docker run -p 4445:80 \
  -e FOURBYTES_POSTGRES_HOST=your-db-host \
  -e FOURBYTES_POSTGRES_USER=your-db-user \
  -e FOURBYTES_POSTGRES_PASSWORD=your-db-password \
  sourcify-4byte
```
