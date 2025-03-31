import type {
  SolidityJsonInput,
  VyperJsonInput,
  VerificationExport,
  CompilationTarget,
} from "@ethereum-sourcify/lib-sourcify";
import type { MatchingErrorResponse } from "../../apiv2/errors";

export interface VerifyFromJsonInputs {
  chainId: string;
  address: string;
  jsonInput: SolidityJsonInput | VyperJsonInput;
  compilerVersion: string;
  compilationTarget: CompilationTarget;
  creationTransactionHash?: string;
}

// We need to return an object from the worker for being able to return an
// error with custom properties. Structured clone only copies the default
// properties (name and message) of Error objects when they are thrown, but
// we want to return our custom `MatchingErrorResponse`.
// Any instance of the `VerifyFromJsonOutput` interface should only contain
// one of the two properties.
export interface VerifyFromJsonOutput {
  verificationExport?: VerificationExport;
  errorResponse?: MatchingErrorResponse;
}
