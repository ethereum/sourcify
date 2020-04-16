CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE bytecode (
    id uuid PRIMARY KEY,
    address text NOT NULL,
    creation_bytecode bytea NOT NULL,
    chain_id integer NOT NULL,
    block_number integer NOT NULL,
    deployed_code_hash bytea NOT NULL
    );

CREATE INDEX chain_id_address_idx ON bytecode (address, chain_id);
CREATE INDEX address_idx ON bytecode (address);
CREATE INDEX chain_dch_cb_idx on bytecode(chain_id, deployed_code_hash, creation_bytecode);
CREATE INDEX address_dch_cb_idx ON bytecode(address, deployed_code_hash, creation_bytecode);
CREATE INDEX address_chain_id_idx ON bytecode(address, chain_id)
