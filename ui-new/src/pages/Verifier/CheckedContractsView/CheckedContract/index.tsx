import React, { MouseEventHandler, useState } from "react";
import { HiChevronDown, HiOutlineExternalLink } from "react-icons/hi";
import DetailedView from "../../../../components/DetailedView";
import LoadingOverlay from "../../../../components/LoadingOverlay";
import {
  SendableContract,
  SessionResponse,
  VerificationInput,
} from "../../../../types";
import ChainAddressForm from "./ChainAddressForm";
import Invalid from "./Invalid";
import Label from "./Label";
import Missing from "./Missing";

type CheckedContractProps = {
  checkedContract: SendableContract;
  verifyCheckedContract: (
    sendable: VerificationInput
  ) => Promise<SessionResponse | undefined>;
  collapsed: boolean;
  toggleCollapse: () => void;
};

const CheckedContract: React.FC<CheckedContractProps> = ({
  checkedContract,
  verifyCheckedContract,
  collapsed,
  toggleCollapse,
}) => {
  const [isDetailedViewShown, setIsDetailedViewShown] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const closeModal = () => {
    setIsDetailedViewShown(false);
  };
  const openModal = () => {
    setIsDetailedViewShown(true);
  };

  const toggleCollapseWrapper: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    toggleCollapse();
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
    <div className="mb-4 bg-gray-100 border-2 border-gray-200 rounded-md p-4 break-words relative">
      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay message="Verifying Contract" />}
      {/* Contract item header */}
      <button
        onClick={toggleCollapseWrapper}
        className="flex flex-row justify-between w-full"
      >
        <h2 className="font-bold text-lg flex items-middle min-w-0 overflow-hidden overflow-ellipsis">
          {checkedContract.name}
        </h2>
        <div className="flex flex-nowrap">
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
      <div className={`${collapsed ? "hidden" : ""} mt-4`}>
        {["perfect", "partial", "error"].includes(customStatus) && (
          <ChainAddressForm
            checkedContract={checkedContract}
            customStatus={customStatus}
            verifyCheckedContract={verifyCheckedContract}
            setIsLoading={setIsLoading}
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
