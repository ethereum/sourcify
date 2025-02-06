# Dune Upload

## Overview

This script facilitates the upload of data from Sourcify's PostgreSQL database to [Dune Analytics](https://dune.com/). It automates the process of creating necessary tables in Dune, fetching data from PostgreSQL, formatting it appropriately, and inserting it into Dune.

## Setup

### Environment Variables

Create a `.env` file in the root of the project with the following variables:

```env: .env
# PostgreSQL Configuration
POSTGRES_HOST=your_postgres_host
POSTGRES_PORT=5432
POSTGRES_USER=your_postgres_user
POSTGRES_DB=your_postgres_database
POSTGRES_PASSWORD=your_postgres_password

# Dune API Configuration
DUNE_API_KEY=your_dune_api_key
```

### Installation

**Install dependencies:**

   ```bash
   npm install
   ```

## Usage

To initiate the upload process, run the following command:

```bash
npx ts-node dune/index.ts
```

This command executes the `index.ts` script, which orchestrates the entire upload process from fetching data to inserting it into Dune.
