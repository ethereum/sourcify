import React from "react";
import {
  SendableContract,
  SessionResponse,
  VerificationInput,
} from "../../../types";
import CheckedContract from "./CheckedContract";

type CheckedContractsViewProps = {
  checkedContracts: SendableContract[];
  isHidden: boolean;
  verifyCheckedContract: (
    sendable: VerificationInput
  ) => Promise<SessionResponse | undefined>;
};

const CheckedContractsView: React.FC<CheckedContractsViewProps> = ({
  checkedContracts,
  isHidden,
  verifyCheckedContract,
}) => {
  if (isHidden) return null;
  return (
    <div className="pt-1 bg-ceruleanBlue-500 flex flex-grow basis-0 rounded-xl mx-2">
      <div
        className={`flex flex-col flex-grow basis-0 shadow-md bg-white rounded-lg px-8`}
      >
        <div className="my-8 flex flex-col justify-center items-center">
          <h2 className="font-bold text-xl text-center">Contracts</h2>
        </div>
        {checkedContracts.map((contract) => (
          <CheckedContract
            key={contract.verificationId}
            checkedContract={contract}
            verifyCheckedContract={verifyCheckedContract}
          />
        ))}
      </div>
    </div>
  );
};

export default CheckedContractsView;
