import React, { MouseEventHandler, useState } from "react";
import { HiChevronDown, HiOutlineExternalLink } from "react-icons/hi";
import Button from "../../../../components/Button";
import DetailedView from "../../../../components/DetailedView";
import LoadingOverlay from "../../../../components/LoadingOverlay";
import {
  SendableContract,
  SessionResponse,
  VerificationInput,
  Create2VerificationInput,
} from "../../../../types";
import ChainAddressForm from "./ChainAddressForm";
import Create2Form from "./Create2Form";
import Invalid from "./Invalid";
import Label from "./Label";
import Missing from "./Missing";

type CheckedContractProps = {
  checkedContract: SendableContract;
  verifyCheckedContract: (
    sendable: VerificationInput
  ) => Promise<SessionResponse | undefined>;
  verifyCreate2CheckedContract: (
    sendable: Create2VerificationInput
  ) => Promise<SessionResponse | undefined>;
  verifyCreate2Compile: (
    verificationId: string
  ) => Promise<SessionResponse | undefined>;
  collapsed: boolean;
  toggleCollapse: () => void;
};

enum VerifyMethods {
  DEPLOYED,
  CREATE2,
}

const CheckedContract: React.FC<CheckedContractProps> = ({
  checkedContract,
  verifyCheckedContract,
  verifyCreate2CheckedContract,
  verifyCreate2Compile,
  collapsed,
  toggleCollapse,
}) => {
  const [verifyMethodSelected, setVerifyMethodSelected] =
    useState<VerifyMethods>(VerifyMethods.DEPLOYED);

  const selectVerifyMethod = (method: VerifyMethods) => {
    if (method === verifyMethodSelected) {
      setVerifyMethodSelected(VerifyMethods.DEPLOYED);
    } else {
      if (
        method === VerifyMethods.CREATE2 &&
        checkedContract.verificationId &&
        !checkedContract.creationBytecode
      ) {
        verifyCreate2Compile(checkedContract.verificationId);
      }
      setVerifyMethodSelected(method);
    }
  };

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
    <div className="mb-4 bg-ceruleanBlue-100 rounded-md relative">
      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay message="Verifying Contract" />}
      {/* Contract item header */}
      <button
        onClick={toggleCollapseWrapper}
        className="flex flex-row justify-between w-full bg-ceruleanBlue-500 rounded-md text-white p-4"
      >
        <h2 className="font-bold text-lg break-all text-left mr-1">
          {checkedContract.name}
        </h2>
        <div className="flex flex-nowrap items-center">
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
      <div className={`${collapsed ? "hidden" : ""} break-words px-4 p-4`}>
        <div className="flex flex-row flex-wrap gap-3 mt-4 justify-center md:justify-start mb-6">
          <div className="">
            <Button
              type={
                verifyMethodSelected === VerifyMethods.DEPLOYED
                  ? "primary"
                  : "white"
              }
              onClick={() => selectVerifyMethod(VerifyMethods.DEPLOYED)}
              className="text-sm"
            >
              Verify deployed contract
            </Button>
          </div>
          <div className="">
            <Button
              type={
                verifyMethodSelected === VerifyMethods.CREATE2
                  ? "primary"
                  : "white"
              }
              onClick={() => selectVerifyMethod(VerifyMethods.CREATE2)}
              className="text-sm"
            >
              Verify create2 contract
            </Button>
          </div>
        </div>
        {verifyMethodSelected === VerifyMethods.DEPLOYED &&
          ["perfect", "partial", "error"].includes(customStatus) && (
            <ChainAddressForm
              checkedContract={checkedContract}
              customStatus={customStatus}
              verifyCheckedContract={verifyCheckedContract}
              setIsLoading={setIsLoading}
            />
          )}
        {verifyMethodSelected === VerifyMethods.CREATE2 &&
          ["perfect", "partial", "error"].includes(customStatus) && (
            <Create2Form
              checkedContract={checkedContract}
              customStatus={customStatus}
              verifyCreate2CheckedContract={verifyCreate2CheckedContract}
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
