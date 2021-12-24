import React, { useState } from "react";
import { HiChevronDown, HiOutlineExternalLink } from "react-icons/hi";
import DetailedView from "../../../../components/DetailedView";
import { SendableContract, VerificationInput } from "../../../../types";
import ChainAddressForm from "./ChainAddressForm";
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
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [isDetailedViewShown, setIsDetailedViewShown] =
    useState<boolean>(false);

  const toggleCollapse: React.MouseEventHandler = (e) => {
    e.preventDefault();
    setCollapsed((c) => !c);
  };

  const closeModal = () => {
    setIsDetailedViewShown(false);
  };

  const openModal = () => {
    setIsDetailedViewShown(true);
  };

  let customStatus;
  if (checkedContract.status === "perfect") customStatus = "perfect";
  else if (checkedContract.status === "partial") customStatus = "partial";
  else if (Object.keys(checkedContract.files.missing).length > 0)
    customStatus = "missing";
  // Missing files status takes precedence over invalid
  else if (Object.keys(checkedContract.files.invalid).length > 0)
    customStatus = "invalid";
  else customStatus = "error";

  return (
    <div className="my-4 bg-gray-300 rounded-md border-2 border-ceruleanBlue-100 p-4 break-words">
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
          <Label customStatus={customStatus} />
          <HiChevronDown
            size="2em"
            className={"inline transition-transform duration-300 ease-in-out"}
            style={collapsed ? {} : { transform: "rotateX(180deg)" }}
          />
        </div>
      </button>

      {/* Collapsed section */}
      <div className={`${collapsed ? "hidden" : ""}`}>
        {["perfect", "partial", "error"].includes(customStatus) && (
          <ChainAddressForm
            checkedContract={checkedContract}
            customStatus={customStatus}
            verifyCheckedContract={verifyCheckedContract}
          />
        )}
        {customStatus === "missing" && (
          <Missing checkedContract={checkedContract} />
        )}
        {customStatus === "invalid" && (
          <Invalid checkedContract={checkedContract} />
        )}
        <DetailedView
          isShown={isDetailedViewShown}
          closeModal={closeModal}
          checkedContract={checkedContract}
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={openModal}
            className="font-bold hover:underline flex items-center"
          >
            <HiOutlineExternalLink className="inline mr-0.5" size="1.25em" />
            Detailed View
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckedContract;
