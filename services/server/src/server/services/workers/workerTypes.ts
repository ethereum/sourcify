import type {
  SolidityJsonInput,
  VyperJsonInput,
  CompilationLanguage,
  VerificationExport,
} from "@ethereum-sourcify/lib-sourcify";
import type { MatchingErrorResponse } from "../../apiv2/errors";

export interface VerifyFromJsonInputs {
  chainId: string;
  address: string;
  language: CompilationLanguage;
  jsonInput: SolidityJsonInput | VyperJsonInput;
  compilerVersion: string;
  contractIdentifier: string;
  creationTransactionHash?: string;
}

export interface VerifyFromJsonOutput {
  verificationExport?: VerificationExport;
  errorResponse?: MatchingErrorResponse;
}
