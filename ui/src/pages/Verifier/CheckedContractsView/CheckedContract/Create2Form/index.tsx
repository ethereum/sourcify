import { getAddress, isAddress } from "@ethersproject/address";
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
import ConstructorArguments from "../../../../../components/ConstructorArguments";
import { BigNumber } from "@ethersproject/bignumber";
import { keccak256 } from "@ethersproject/keccak256";
import { isHexString, hexZeroPad } from "@ethersproject/bytes";
import InputToggle from "../../../../../components/InputToggle";

export const saltToHex = (salt: string) => {
  if (isHexString(salt)) {
    return hexZeroPad(salt, 32);
  }
  const bn = BigNumber.from(salt);
  const hex = bn.toHexString();
  const paddedHex = hexZeroPad(hex, 32);
  return paddedHex;
};

const buildCreate2Address = (
  factoryAddress: string,
  saltHex: string,
  byteCode: string
) => {
  const address = `0x${keccak256(
    `0x${["ff", factoryAddress, saltHex, keccak256(byteCode)]
      .map((x) => x.replace(/0x/, ""))
      .join("")}`
  ).slice(-40)}`.toLowerCase();
  return getAddress(address); //checksum
};

type ChainAddressFormProps = {
  customStatus: string;
  checkedContract: SendableContract;
  verifyCreate2CheckedContract: (
    sendable: Create2VerificationInput
  ) => Promise<SessionResponse | undefined>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
};
const Create2Form = ({
  customStatus,
  checkedContract,
  verifyCreate2CheckedContract,
  setIsLoading,
}: ChainAddressFormProps) => {
  const [clientToken, setClientToken] = useState<string>();
  const [deployerAddress, setDeployerAddress] = useState<string>();
  const [salt, setSalt] = useState<string>();
  const [abiEncodedConstructorArguments, setAbiEncodedConstructorArguments] =
    useState<string>("");
  const [create2Address, setcreate2Address] = useState<string>();

  const [isInvalidDeployerAddress, setIsInvalidDeploylerAddress] =
    useState<boolean>(false);
  const [foundMatches, setFoundMatches] = useState<CheckAllByAddressResult>();
  const verifyButtonRef = useRef<HTMLButtonElement>(null);
  const [showRawAbiInput, setShowRawAbiInput] = useState(false);
  const [isInvalidConstructorArguments, setIsInvalidConstructorArguments] =
    useState(false);

  useEffect(() => {
    if (
      !deployerAddress ||
      !salt ||
      !checkedContract?.creationBytecode ||
      isInvalidDeployerAddress ||
      isInvalidConstructorArguments
    ) {
      return setcreate2Address(undefined);
    }
    const initcode =
      checkedContract.creationBytecode +
      (abiEncodedConstructorArguments.startsWith("0x")
        ? abiEncodedConstructorArguments.slice(2)
        : abiEncodedConstructorArguments || "");
    const create2Address = buildCreate2Address(
      deployerAddress,
      saltToHex(salt),
      initcode
    );
    if (create2Address) {
      setcreate2Address(create2Address);
    } else {
      setcreate2Address(undefined);
    }
  }, [
    deployerAddress,
    salt,
    checkedContract,
    abiEncodedConstructorArguments,
    isInvalidConstructorArguments,
    isInvalidDeployerAddress,
  ]);

  const handleAddressChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const tempAddr = e.target.value;
    setDeployerAddress(tempAddr);
    const isValid = isAddress(tempAddr);
    if (!isValid) {
      setFoundMatches(undefined);
      return setIsInvalidDeploylerAddress(true);
    }
    setIsInvalidDeploylerAddress(false);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (
      !deployerAddress ||
      isInvalidDeployerAddress ||
      isInvalidConstructorArguments
    )
      return;
    setIsLoading(true);
    verifyCreate2CheckedContract({
      verificationId: checkedContract.verificationId || "",
      deployerAddress: deployerAddress || "",
      salt: salt || "",
      abiEncodedConstructorArguments,
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
              {isInvalidDeployerAddress && (
                <span className="text-red-500 text-sm">
                  Invalid Deployer Address
                </span>
              )}
            </div>
            <Input
              id="address"
              value={deployerAddress}
              onChange={handleAddressChange}
              placeholder="0x2fabe97..."
              className="mb-2"
            />
          </div>
          <div>
            <div className="flex justify-between">
              <label className="block" htmlFor="salt">
                Salt (in hex or number)
              </label>
            </div>
            <Input
              id="salt"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              placeholder="0xb1f2... or 999"
              className="mb-2"
            />
            {checkedContract.constructorArgumentsArray &&
              checkedContract.constructorArgumentsArray.length > 0 && (
                <div className="mt-4">
                  <InputToggle
                    isChecked={showRawAbiInput}
                    onClick={() => setShowRawAbiInput((prev) => !prev)}
                    label="Raw ABI-Encoded Input"
                  />
                  <ConstructorArguments
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
          </div>

          {create2Address && (
            <div className="mt-4 text-sm break-all">
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

export default Create2Form;
