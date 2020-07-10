export interface FileObject {
    name: string,
    path: string
    content?: string
  }

export interface InputData {
    repository: string,
    chain: string,
    addresses: string[],
    files?: any[],
    bytecode?: string
}

export declare interface StringMap {
  [key: string]: string;
}

export declare interface ReformattedMetadata {
  input: any,
  fileName: string,
  contractName: string
}

export interface RecompilationResult {
  bytecode: string,
  deployedBytecode: string,
  metadata: string
}

export interface Match {
  address: string | null,
  status: 'perfect' | 'partial' | null
}
