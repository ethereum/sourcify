import { isAddress } from "@ethersproject/address";
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
import TextArea from "../../../../../components/TextArea";
import ReactTooltip from "react-tooltip";
import { renderToString } from "react-dom/server";

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
  const [address, setAddress] = useState<string>();
  const [isInvalidAddress, setIsInvalidAddress] = useState<boolean>(false);
  const [chainId, setChainId] = useState<string>();
  const [foundMatches, setFoundMatches] = useState<CheckAllByAddressResult>();
  const { sourcifyChains } = useContext(Context);
  const verifyButtonRef = useRef<HTMLButtonElement>(null);
  const [isMoreFieldsOpen, setIsMoreFieldsOpen] = useState<boolean>(false);
  const [constructorArguments, setconstructorArguments] = useState<string>();
  const [msgSender, setMsgSender] = useState<string>();
  const [isInvalidMsgSender, setIsInvalidMsgSender] = useState<boolean>(false);

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
    setAddress(tempAddr);
    const isValid = isAddress(tempAddr);
    if (!isValid) {
      setFoundMatches(undefined);
      return setIsInvalidAddress(true);
    }
    setIsInvalidAddress(false);
    checkAllByAddresses(
      tempAddr,
      sourcifyChains.map((c) => c.chainId.toString()).join(",")
    ).then((res) => {
      // checkAllByAddresses inputs and outptus multiple addresses.
      const currentAddressMatches = res.find(
        (match) => (match.address = tempAddr)
      );
      setFoundMatches(currentAddressMatches);
    });
  };

  const handleChainIdChange = (newChainId: number) => {
    const newChainIdStr = newChainId.toString();
    setChainId(newChainIdStr);
    verifyButtonRef.current?.focus();
    console.log(`New id is: ${newChainId}`);
  };

  const handleconstructorArgumentsChange: ChangeEventHandler<
    HTMLTextAreaElement
  > = (e) => {
    setconstructorArguments(e.target.value);
  };

  const handleMsgSenderChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const tempAddr = e.target.value;
    setMsgSender(tempAddr);
    const isValid = isAddress(tempAddr);
    if (!isValid && tempAddr !== "") {
      // msg.sender can be empty
      return setIsInvalidMsgSender(true);
    }
    setIsInvalidMsgSender(false);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!address || !chainId || isInvalidAddress || isInvalidMsgSender) return;
    setIsLoading(true);
    verifyCheckedContract({
      verificationId: checkedContract.verificationId || "",
      address: address || "",
      chainId: chainId,
      constructorArguments: constructorArguments,
      msgSender,
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
          className="py-1 text-ceruleanBlue-600 mt-2"
        >
          More Inputs
          <HiChevronDown
            size="1.75em"
            className={"inline transition-transform duration-300 ease-in-out "}
            style={!isMoreFieldsOpen ? {} : { transform: "rotateX(180deg)" }}
          />
        </button>

        {/* Constructor arguments, msg.sender etc fields. */}
        <div className={`${isMoreFieldsOpen ? "flex" : "hidden"} flex-col`}>
          {/* Constructor arguments */}
          <div className="mt-2">
            <label className="flex flex-row items-center " htmlFor="address">
              ABI-Encoded Constructor Arguments
              <ReactTooltip
                effect="solid"
                delayHide={500}
                clickable={true}
                className="max-w-xl"
                id="partial-info"
              />
              <span
                className="ml-1 w-5 h-5 text-sm bg-ceruleanBlue-300 text-ceruleanBlue-100 rounded-full flex items-center justify-center"
                data-tip={renderToString(
                  <div>
                    Constructor arguments used when creating the contract in{" "}
                    <a
                      href="https://docs.soliditylang.org/en/latest/abi-spec.html"
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ABI-Encoding
                    </a>
                    . You can use{" "}
                    <a
                      href="https://abi.hashex.org/"
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      this online tool
                    </a>{" "}
                    to encode the arguments.
                  </div>
                )}
                data-html={true}
                data-for="partial-info"
              >
                ?
              </span>
            </label>
            <TextArea
              id="contructorArgs"
              value={constructorArguments}
              onChange={handleconstructorArgumentsChange}
              placeholder="00000000000000000000000000000000d41867734bbee4c6863d9255b2b06ac1000000000000000000000000000000000000000000000000000000000001e240..."
              className="mb-2"
            />
          </div>

          {/* msg.sender */}
          <div className="mt-2">
            <div className="flex justify-between">
              <label className="block" htmlFor="msgSender">
                msg.sender
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
        </div>

        <button
          ref={verifyButtonRef}
          type="submit"
          className="mt-4 py-2 px-4 w-full bg-ceruleanBlue-500 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default "
          disabled={
            !address || !chainId || isInvalidAddress || isInvalidMsgSender
          }
        >
          Verify
        </button>
      </form>
    </div>
  );
};

export default ChainAddressForm;
