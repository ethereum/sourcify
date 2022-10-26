import { isAddress } from "@ethersproject/address";
import React, {
  ChangeEventHandler,
  FormEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import Input from "../../../../../components/Input";
import {
  CheckAllByAddressResult,
  SendableContract,
  SessionResponse,
  Create2VerificationInput,
} from "../../../../../types";
import Message from "../ChainAddressForm/Message";
import LoadingOverlay from "../../../../../components/LoadingOverlay";

const { keccak256 } = require("@ethersproject/keccak256");
const { isHexString } = require("@ethersproject/bytes");
const { id } = require("@ethersproject/hash");
const { defaultAbiCoder } = require("@ethersproject/abi");

export const saltToHex = (salt: string | number) => {
  salt = salt.toString();
  if (isHexString(salt)) {
    return salt;
  }

  return id(salt);
};

export const encodeParams = (dataTypes: any[], data: any[]) => {
  return defaultAbiCoder.encode(dataTypes, data);
};

export const buildBytecode = (
  constructorTypes: any[],
  constructorArgs: any[],
  contractBytecode: string
) => {
  try {
    return `${contractBytecode}${encodeParams(
      constructorTypes,
      constructorArgs
    ).slice(2)}`;
  } catch (e) {
    return false;
  }
};

const buildCreate2Address = (
  factoryAddress: string,
  saltHex: string,
  byteCode: string
) => {
  return `0x${keccak256(
    `0x${["ff", factoryAddress, saltHex, keccak256(byteCode)]
      .map((x) => x.replace(/0x/, ""))
      .join("")}`
  ).slice(-40)}`.toLowerCase();
};

function getCreate2Address({
  factoryAddress,
  salt,
  contractBytecode,
  constructorTypes = [] as string[],
  constructorArgs = [] as any[],
}: {
  factoryAddress: string;
  salt: string | number;
  contractBytecode: string;
  constructorTypes?: string[];
  constructorArgs?: any[];
}) {
  const bytecode = buildBytecode(
    constructorTypes,
    constructorArgs,
    contractBytecode
  );
  if (bytecode) {
    try {
      return buildCreate2Address(factoryAddress, saltToHex(salt), bytecode);
    } catch (e) {
      return false;
    }
  } else {
    return false;
  }
}

type ConstructorArgs = {
  type: string;
  value: any;
};

type ChainAddressFormProps = {
  customStatus: string;
  checkedContract: SendableContract;
  verifyCreate2CheckedContract: (
    sendable: Create2VerificationInput
  ) => Promise<SessionResponse | undefined>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
};
const CounterfactualForm = ({
  customStatus,
  checkedContract,
  verifyCreate2CheckedContract,
  setIsLoading,
}: ChainAddressFormProps) => {
  const [clientToken, setClientToken] = useState<string>();
  const [address, setAddress] = useState<string>();
  const [salt, setSalt] = useState<string>();
  const [constructorArgs, setConstructorArgs] = useState<ConstructorArgs[]>([]);
  const [create2Address, setcreate2Address] = useState<string>();

  function setConstructorArgsValue(value: any, index: number) {
    const nextConstructorArgs = constructorArgs.map((c, i) => {
      if (i === index) {
        return {
          type: c.type,
          value,
        };
      } else {
        return c;
      }
    });
    setConstructorArgs(nextConstructorArgs);
  }

  const [isInvalidAddress, setIsInvalidAddress] = useState<boolean>(false);
  const [foundMatches, setFoundMatches] = useState<CheckAllByAddressResult>();
  const verifyButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const equals = (a: any, b: any) =>
      a.length === b.length &&
      a.every((v: any, i: number) => v.type === b[i].type);

    const nextConstructorArgs = checkedContract?.constructorArguments?.map(
      (arg: any) => ({
        type: arg.type,
        value: "",
      })
    );

    if (
      checkedContract?.constructorArguments &&
      nextConstructorArgs &&
      constructorArgs &&
      !equals(nextConstructorArgs, constructorArgs)
    ) {
      setConstructorArgs(nextConstructorArgs);
    }
  }, [setAddress, setConstructorArgs, constructorArgs, checkedContract]);

  useEffect(() => {
    if (!address || !salt || !checkedContract?.creationBytecode) {
      return setcreate2Address(undefined);
    }
    const create2Address = getCreate2Address({
      factoryAddress: address,
      salt: salt,
      contractBytecode: checkedContract?.creationBytecode,
      constructorTypes: constructorArgs.map((args) => args.type),
      constructorArgs: constructorArgs.map((args) => args.value),
    });
    if (create2Address) {
      setcreate2Address(create2Address);
    } else {
      setcreate2Address(undefined);
    }
  }, [address, salt, constructorArgs, checkedContract]);

  const handleAddressChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const tempAddr = e.target.value;
    setAddress(tempAddr);
    const isValid = isAddress(tempAddr);
    if (!isValid) {
      setFoundMatches(undefined);
      return setIsInvalidAddress(true);
    }
    setIsInvalidAddress(false);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!address || isInvalidAddress) return;
    setIsLoading(true);
    verifyCreate2CheckedContract({
      verificationId: checkedContract.verificationId || "",
      deployerAddress: address || "",
      salt: salt || "",
      constructorArgs,
      create2Address: create2Address || "",
      clientToken: clientToken || "",
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
      {checkedContract?.creationBytecode ? (
        <form className="mt-4" onSubmit={handleSubmit}>
          <div>
            <div className="flex justify-between">
              <label className="block" htmlFor="clientToken">
                Client token
                <p className="mb-1 text-xs">
                  This functionality is protected by a client token in order to
                  prevent spamming. If you are interested please send an email
                  to <a href="mailto:info@sourcify.dev">info@sourcify.dev</a>
                </p>
              </label>
            </div>
            <Input
              id="clientToken"
              value={clientToken}
              onChange={(e) => setClientToken(e.target.value)}
              placeholder="CLIENT_TOKEN"
              className="mb-2"
            />
          </div>
          <div>
            <div className="flex justify-between">
              <label className="block" htmlFor="address">
                Deployer Address
              </label>
              {isInvalidAddress && (
                <span className="text-red-500 text-sm">
                  Invalid Deployer Address
                </span>
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
            <div className="flex justify-between">
              <label className="block" htmlFor="salt">
                Salt
              </label>
            </div>
            <Input
              id="salt"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              placeholder="1"
              className="mb-2"
            />
          </div>
          {Array.isArray(checkedContract.constructorArguments) && (
            <div className="flex flex-col">
              <div className="flex justify-between">
                <label className="block">Constructor arguments</label>
              </div>
              {checkedContract?.constructorArguments?.map((args, index) => (
                <div className="ml-5" key={`constructor_${index}`}>
                  <div className="flex justify-between">
                    <label className="block" htmlFor={args.name}>
                      {args.name}
                    </label>
                  </div>
                  <Input
                    id={args.name}
                    value={constructorArgs[index]?.value}
                    onChange={(e) =>
                      setConstructorArgsValue(e.target.value, index)
                    }
                    placeholder=""
                    className="mb-2"
                  />
                </div>
              ))}
            </div>
          )}
          {create2Address && (
            <div className="mt-4 text-sm">
              <strong>Address:</strong> {create2Address}
            </div>
          )}
          <button
            ref={verifyButtonRef}
            type="submit"
            className="mt-4 py-2 px-4 w-full bg-ceruleanBlue-500 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default "
            disabled={!create2Address}
          >
            Verify
          </button>
        </form>
      ) : (
        <LoadingOverlay message="Getting creation bytecode" />
      )}
    </div>
  );
};

export default CounterfactualForm;
