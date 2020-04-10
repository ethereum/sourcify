CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE bytecode (
    id uuid PRIMARY KEY,
    creation_bytecode text NOT NULL,
    chain_id integer NOT NULL,
    block_number integer NOT NULL,
    deployed_code_hash text NOT NULL
    );

CREATE INDEX deployed_code_hash_idx ON bytecode (deployed_code_hash);
CREATE INDEX chain_id_idx ON bytecode (chain_id);
CREATE INDEX block_number_idx ON bytecode (block_number);
CREATE INDEX chain_dch_cb_idx ON bytecode (chain_id, deployed_code_hash, creation_bytecode);
