# Sourcify -> Verifier Alliance sync

This script is needed to push all verified_contracts from one Sourcify to VerA database. VerA is a live database in which other entities are writing while the script is running.

0. CURRENT_VERIFIED_CONTRACT is a variable stored in a permanent file, default 1.
1. Extract N verified_contracts starting from CURRENT_VERIFIED_CONTRACT
2. For each verified_contract:
   a. Update the CURRENT_VERIFIED_CONTRACT counter
   b. Get all information from verified_contracts
   c. Get all the FK information
   d. Insert all the verified_contracts dependencies (compiled_contracts,contract_deployments,contracts,code) and verified_contracts using the new ids as FKs
