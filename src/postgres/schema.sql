CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE metadata (
    id uuid PRIMARY KEY,
    address text NOT NULL,
    creationBytecode bytea NOT NULL,
    chainId integer,
    blockNumber integer NOT NULL,
    deployedCodeHash bytea NOT NULL
    );

CREATE INDEX chain_id_address_idx ON metadata (address, chain_id);
CREATE INDEX address_idx ON metadata (address);
CREATE INDEX chain_dch_cb_idx on metadata(chain_id, deployed_code_hash, creation_bytecode);
CREATE INDEX address_dch_cb_idx ON metadata(address, deployed_code_hash, creation_bytecode);
CREATE INDEX address_chain_id_idx ON metadata(address, chain_id)
