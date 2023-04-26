import { isHexString } from "@ethersproject/bytes";
import { getAddress } from "@ethersproject/address";
import React, {
  ChangeEventHandler,
  FormEventHandler,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Input from "../../../../../components/Input";
import ChainSelect from "../../../../../components/ChainSelect";
import { Context } from "../../../../../Context";
import {
  CheckAllByAddressResult,
  SendableContract,
  SessionResponse,
  VerificationInput,
} from "../../../../../types";
import { checkAllByAddresses } from "../../../../../utils/api";
import Message from "./Message";
import { HiChevronDown } from "react-icons/hi";
import ReactTooltip from "react-tooltip";
import { SelectedOptionValue } from "react-select-search";
/* import Constructorarguments from "../../../../../components/ConstructorArguments";
import InputToggle from "../../../../../components/InputToggle"; */

type ChainAddressFormProps = {
  customStatus: string;
  checkedContract: SendableContract;
  verifyCheckedContract: (
    sendable: VerificationInput
  ) => Promise<SessionResponse | undefined>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
};
const ChainAddressForm = ({
  customStatus,
  checkedContract,
  verifyCheckedContract,
  setIsLoading,
}: ChainAddressFormProps) => {
  const [address, setAddress] = useState<string>("");
  const [isInvalidAddress, setIsInvalidAddress] = useState<boolean>(false);
  const [chainId, setChainId] = useState<string>();
  const [foundMatches, setFoundMatches] = useState<CheckAllByAddressResult>();
  const { sourcifyChains } = useContext(Context);
  const verifyButtonRef = useRef<HTMLButtonElement>(null);
  const [isMoreFieldsOpen, setIsMoreFieldsOpen] = useState<boolean>(false);
  /* const [abiEncodedConstructorArguments, setAbiEncodedConstructorArguments] =
    useState<string>("");
  const [msgSender, setMsgSender] = useState<string>(""); */
  /* const [isInvalidMsgSender, setIsInvalidMsgSender] = useState<boolean>(false); */
  const [creatorTxHash, setCreatorTxHash] = useState<string>("");
  const [isInvalidCreatorTxHash, setIsInvalidCreatorTxHash] =
    useState<boolean>(false);
  /* const [showRawAbiInput, setShowRawAbiInput] = useState(false);
  const [isInvalidConstructorArguments, setIsInvalidConstructorArguments] =
    useState(false); */

  useEffect(() => {
    if (checkedContract.address) {
      setAddress(checkedContract.address);
    }

    if (checkedContract.chainId) {
      setChainId(checkedContract.chainId);
    }
  }, [setAddress, setChainId, checkedContract]);

  const handleAddressChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const tempAddr = e.target.value;
    let checksummedAddress: string;
    try {
      // getAddress: returns the checksummed address only if you pass all lowercase
      // if you pass a wrong checksum then in throws, so I'm converting the address
      // to lowercase
      checksummedAddress = getAddress(tempAddr.toLowerCase());
      setAddress(checksummedAddress);
      setIsInvalidAddress(false);
    } catch (e) {
      setFoundMatches(undefined);
      setAddress(tempAddr);
      return setIsInvalidAddress(true);
    }

    checkAllByAddresses(
      checksummedAddress,
      sourcifyChains.map((c) => c.chainId.toString()).join(",")
    ).then((res) => {
      // checkAllByAddresses inputs and outptus multiple addresses.
      const currentAddressMatches = res.find(
        (match) => (match.address = checksummedAddress)
      );
      setFoundMatches(currentAddressMatches);
    });
  };

  const handleChainIdChange = (
    selectedOptionValue: SelectedOptionValue | SelectedOptionValue[]
  ) => {
    const newChainIdStr = `${selectedOptionValue as SelectedOptionValue}`;
    setChainId(newChainIdStr);
    verifyButtonRef.current?.focus();
  };

  /* const handleMsgSenderChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const tempAddr = e.target.value;
    setMsgSender(tempAddr);
    const isValid = isAddress(tempAddr);
    if (!isValid && tempAddr !== "") {
      // msg.sender can be empty
      return setIsInvalidMsgSender(true);
    }
    setIsInvalidMsgSender(false);
  }; */

  const handleCreatorTxHashChange: ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    const tempHash = e.target.value;
    setCreatorTxHash(tempHash);
    if (!isHexString(tempHash, 32) && tempHash !== "") {
      return setIsInvalidCreatorTxHash(true);
    }
    setIsInvalidCreatorTxHash(false);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!address || !chainId || isInvalidAddress /* || isInvalidMsgSender */)
      return;
    setIsLoading(true);
    verifyCheckedContract({
      verificationId: checkedContract.verificationId || "",
      address: address || "",
      chainId: chainId,
      /* contextVariables: {
        abiEncodedConstructorArguments,
        msgSender,
      }, */
      creatorTxHash,
    }).finally(() => setIsLoading(false));
  };

  return (
    <div className="">
      <div className="">
        <Message
          customStatus={customStatus}
          checkedContract={checkedContract}
          foundMatches={foundMatches}
        />
      </div>
      <form className="mt-4" onSubmit={handleSubmit}>
        <div>
          <div className="flex justify-between">
            <label className="block" htmlFor="address">
              Address
            </label>
            {isInvalidAddress && (
              <span className="text-red-500 text-sm">Invalid Address</span>
            )}
          </div>
          <Input
            id="address"
            value={address}
            onChange={handleAddressChange}
            placeholder="0x2fabe97..."
            className="mb-2"
          />
        </div>
        <div>
          <label className="block" htmlFor="chain-select">
            Chain
          </label>
          <ChainSelect
            id="chain-select"
            value={chainId}
            handleChainIdChange={handleChainIdChange}
          />
        </div>

        <button
          onClick={() => setIsMoreFieldsOpen((prevValue) => !prevValue)}
          className="py-1 text-ceruleanBlue-600 mt-2 w-full"
          type="button"
        >
          More Inputs (optional)
          <HiChevronDown
            size="1.75em"
            className={"inline transition-transform duration-300 ease-in-out "}
            style={!isMoreFieldsOpen ? {} : { transform: "rotateX(180deg)" }}
          />
        </button>

        {/* CreatorTx, Constructor arguments, msg.sender etc fields. */}
        <div
          className={`${isMoreFieldsOpen ? "flex" : "hidden"} flex-col mt-2`}
        >
          {/* Creator Tx Hash */}
          <div className="">
            <div className="flex justify-between">
              <ReactTooltip
                effect="solid"
                delayHide={500}
                clickable={true}
                className="max-w-xl"
                id="creator-tx-hash-tooltip"
              />
              <label className="block" htmlFor="creatorTxHash">
                Creator Tx Hash{" "}
                <span
                  className="ml-1 text-ceruleanBlue-200 font-bold"
                  data-for="creator-tx-hash-tooltip"
                  data-tip="If your contract has immutable variables, we will look for the tx.input of transaction that created the contract to see if it matches the creation bytecode. If you leave this blank and we need it, we will try getting it ourselves from block explorers or APIs that provide this data."
                >
                  ?
                </span>
              </label>
              {isInvalidCreatorTxHash && (
                <span className="text-red-500 text-sm">
                  Invalid Transaction Hash String
                </span>
              )}
            </div>

            <Input
              id="creatorTxHash"
              value={creatorTxHash}
              onChange={handleCreatorTxHashChange}
              placeholder="0x2fabe97..."
              className="mb-2"
            />
          </div>
          {/* Inputs below are used for verification with simulation
           
          <div className="text-sm text-gray-600 mb-4 mt-6">
            Inputs below will be used to simulate the creation of the contract.
            This helps us verify contracts created by a factory contract. <br />
            If there are other variables your contract makes use of during
            creation, please let us know.
          </div>
          
          {checkedContract?.constructorArgumentsArray &&
            checkedContract?.constructorArgumentsArray.length > 0 && (
              <div>
                <InputToggle
                  isChecked={showRawAbiInput}
                  onClick={() => setShowRawAbiInput((prev) => !prev)}
                  label="Raw ABI-Encoded Input"
                />
                <Constructorarguments
                  abiEncodedConstructorArguments={
                    abiEncodedConstructorArguments
                  }
                  setAbiEncodedConstructorArguments={
                    setAbiEncodedConstructorArguments
                  }
                  abiJsonConstructorArguments={
                    checkedContract.constructorArgumentsArray
                  }
                  showRawAbiInput={showRawAbiInput}
                  setIsInvalidConstructorArguments={
                    setIsInvalidConstructorArguments
                  }
                />
              </div>
            )}
          
          <div className="mt-2">
            <div className="flex justify-between">
              <ReactTooltip
                effect="solid"
                delayHide={500}
                clickable={true}
                className="max-w-xl"
                id="msg-sender-tooltip"
              />
              <label className="block" htmlFor="msgSender">
                msg.sender{" "}
                <span
                  className="ml-1 text-ceruleanBlue-200 font-bold"
                  data-for="msg-sender-tooltip"
                  data-tip="`msg.sender` will be used if your contract assigns it to an immutable variable such as an `owner`. In the case of a contract created by a factory, this is the factory address"
                >
                  ?
                </span>
              </label>
              {isInvalidMsgSender && (
                <span className="text-red-500 text-sm">Invalid Address</span>
              )}
            </div>

            <Input
              id="msgSender"
              value={msgSender}
              onChange={handleMsgSenderChange}
              placeholder="0x2fabe97..."
              className="mb-2"
            />
          </div>
           */}
        </div>

        <button
          ref={verifyButtonRef}
          type="submit"
          className="mt-4 py-2 px-4 w-full bg-ceruleanBlue-500 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default "
          disabled={
            !address || !chainId || isInvalidAddress /*  ||
            isInvalidMsgSender ||
            isInvalidConstructorArguments */
          }
        >
          Verify
        </button>
      </form>
    </div>
  );
};

export default ChainAddressForm;
