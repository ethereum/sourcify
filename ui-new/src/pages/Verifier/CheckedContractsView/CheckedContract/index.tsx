import React, { useState } from "react";
import { HiChevronDown } from "react-icons/hi";
import { SendableContract, VerificationInput } from "../../../../types";
import ChainAddressMissing from "./ChainAddressMissing";
import Invalid from "./Invalid";
import Label from "./Label";
import Missing from "./Missing";

type CheckedContractProps = {
  checkedContract: SendableContract;
  verifyCheckedContract: (sendable: VerificationInput) => void;
};

const CheckedContract: React.FC<CheckedContractProps> = ({
  checkedContract,
  verifyCheckedContract,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const toggleCollapse: React.MouseEventHandler = (e) => {
    e.preventDefault();
    setCollapsed((c) => !c);
  };

  let status;
  if (checkedContract.status === "perfect") status = "perfect";
  else if (checkedContract.status === "partial") status = "partial";
  else if (checkedContract.files.missing.length > 0) status = "missing";
  // Missing files status takes precedence over invalid
  else if (Object.keys(checkedContract.files.invalid).length > 0)
    status = "invalid";
  else if (checkedContract.status === "error") status = "chainAddress";
  else status = "error";

  return (
    <div className="my-4 bg-gray-300 rounded-md border-2 border-ceruleanBlue-100 p-4 break-all">
      {/* Contract item header */}
      <button
        onClick={toggleCollapse}
        className="flex flex-row justify-between w-full"
      >
        <h2 className="font-bold text-lg flex items-center">
          {checkedContract.name}
        </h2>
        <div>
          {/* <div className="flex flex-row items-center"> */}
          <Label status={status} />
          <HiChevronDown size="2em" className="inline" />
        </div>
      </button>

      {/* Collapsed section */}
      <div className={`${collapsed ? "hidden" : ""}`}>
        {["perfect", "partial"].includes(status) && (
          <div>
            <p>
              Contract {status}ly verified at {checkedContract.chainId} -{" "}
              {checkedContract.address}
            </p>
          </div>
        )}
        {status === "chainAddress" && (
          <ChainAddressMissing
            checkedContract={checkedContract}
            status={status}
            verifyCheckedContract={verifyCheckedContract}
          />
        )}
        {status === "missing" && <Missing checkedContract={checkedContract} />}
        {status === "invalid" && <Invalid checkedContract={checkedContract} />}
      </div>
    </div>
  );
};

export default CheckedContract;
