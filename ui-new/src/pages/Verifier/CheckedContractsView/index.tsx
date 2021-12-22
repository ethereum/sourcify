import React from "react";
import { SendableContract, VerificationInput } from "../../../types";
import CheckedContract from "./CheckedContract";

type CheckedContractsViewProps = {
  checkedContracts: SendableContract[];
  isHidden: boolean;
  verifyCheckedContract: (sendable: VerificationInput) => {};
};

const CheckedContractsView: React.FC<CheckedContractsViewProps> = ({
  checkedContracts,
  isHidden,
  verifyCheckedContract,
}) => {
  if (isHidden) return null;
  return (
    <div
      className={`flex flex-col flex-grow basis-0 bg-gray-200 shadow-lg rounded-lg mx-4 px-8`}
    >
      <div className="my-6 flex flex-col justify-center items-center">
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
  );
};

export default CheckedContractsView;
