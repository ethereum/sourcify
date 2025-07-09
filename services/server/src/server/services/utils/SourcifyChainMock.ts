import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import { TransactionReceipt, TransactionResponse } from "ethers";
import { PoolClient } from "pg";
import { bytesFromString } from "./database-util";

interface ContractDeployment {
  verified_contract_id: number;
  address: Buffer;
  transaction_hash: Buffer;
  chain_id: number;
  block_number: number;
  transaction_index: number;
  deployer: Buffer;
  onchain_creation_code: Buffer;
  onchain_runtime_code: Buffer;
}

export default class SourcifyChainMock extends SourcifyChain {
  public contractDeployment?: ContractDeployment;
  constructor(
    private readonly poolClient: PoolClient,
    public readonly chainId: number,
    private readonly address: string,
    private readonly transactionHash: string,
  ) {
    super({
      name: "SourcifyChainMock",
      chainId: chainId,
      rpc: ["http://mock"],
      supported: true,
    });
  }

  async init() {
    const deploymentResult = await this.poolClient.query(
      `SELECT 
          verified_contracts.id as verified_contract_id,
          contract_deployments.address,
          contract_deployments.transaction_hash,
          contract_deployments.chain_id,
          contract_deployments.block_number,
          contract_deployments.transaction_index,
          encode(contract_deployments.deployer, 'hex') as deployer,
          onchain_creation_code.code as onchain_creation_code,
          onchain_runtime_code.code as onchain_runtime_code
        FROM contract_deployments
        JOIN verified_contracts ON verified_contracts.deployment_id = contract_deployments.id
        JOIN sourcify_matches ON sourcify_matches.verified_contract_id = verified_contracts.id
        JOIN contracts ON contracts.id = contract_deployments.contract_id
        JOIN code onchain_creation_code ON onchain_creation_code.code_hash = contracts.creation_code_hash
        JOIN code onchain_runtime_code ON onchain_runtime_code.code_hash = contracts.runtime_code_hash
        WHERE contract_deployments.address = $1 AND contract_deployments.transaction_hash = $2 AND contract_deployments.chain_id = $3`,
      [
        bytesFromString(this.address),
        bytesFromString(this.transactionHash),
        this.chainId,
      ],
    );
    if (deploymentResult.rows.length === 0) {
      throw new Error("Contract not found");
    }
    this.contractDeployment = deploymentResult.rows[0];
  }

  getBytecode = async () => {
    if (!this.contractDeployment) {
      throw new Error("SourcifyChainMock not initialized yet");
    }
    return `0x${this.contractDeployment.onchain_runtime_code.toString("hex")}`;
  };

  getTx = async () => {
    if (!this.contractDeployment) {
      throw new Error("SourcifyChainMock not initialized yet");
    }
    return {
      blockNumber: this.contractDeployment.block_number,
      from: `0x${this.contractDeployment.deployer.toString("hex")}`,
    } as TransactionResponse;
  };

  getContractCreationBytecodeAndReceipt = async () => {
    if (!this.contractDeployment) {
      throw new Error("SourcifyChainMock not initialized yet");
    }
    return {
      creationBytecode: `0x${this.contractDeployment.onchain_creation_code.toString("hex")}`,
      txReceipt: {
        index: this.contractDeployment.transaction_index,
      } as TransactionReceipt,
    };
  };
}
