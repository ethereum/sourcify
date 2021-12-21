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
    <div className={`flex flex-col flex-grow basis-0 bg-red-200 mx-4 px-8`}>
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
