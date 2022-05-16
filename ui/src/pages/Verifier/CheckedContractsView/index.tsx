import React, { useEffect, useState } from "react";
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
  const [collapsed, setCollapsed] = useState<boolean[]>([]);

  useEffect(() => {
    const diff = checkedContracts.length - collapsed.length;
    if (diff > 0) {
      setCollapsed((prevArr) => prevArr.concat(new Array(diff).fill(true)));
    }
  }, [checkedContracts.length, collapsed.length]);

  const collapseAll = () => {
    setCollapsed(new Array<boolean>(checkedContracts.length).fill(true));
  };

  const toggleCollapse = (i: number) => {
    setCollapsed((prevCollapsed) => {
      const tempCollapsed = [...prevCollapsed];
      tempCollapsed[i] = !tempCollapsed[i];
      return tempCollapsed;
    });
  };
  if (isHidden) return null;
  return (
    <div className="pt-1 bg-ceruleanBlue-500 flex flex-grow basis-0 rounded-xl mx-2">
      <div
        className={`flex flex-col flex-grow basis-0 shadow-md bg-white rounded-lg px-8`}
      >
        <div className="my-8 flex flex-col justify-center items-center">
          <h2 className="font-bold text-xl text-center">Contracts</h2>
        </div>
        <div>
          <div className="flex justify-end">
            <button
              className="text-ceruleanBlue-500 font-medium hover:underline decoration-2 decoration-lightCoral-500 uppercase py-1 text-sm"
              onClick={collapseAll}
            >
              Collapse All
            </button>
          </div>
          {checkedContracts.map((contract, i) => (
            <CheckedContract
              key={contract.verificationId}
              collapsed={collapsed[i]}
              toggleCollapse={() => toggleCollapse(i)}
              checkedContract={contract}
              verifyCheckedContract={verifyCheckedContract}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CheckedContractsView;
