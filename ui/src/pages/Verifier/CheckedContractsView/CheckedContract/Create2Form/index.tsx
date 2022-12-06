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
import ConstructorArguments from "../../../../../components/ConstructorArguments";
import { keccak256 } from "@ethersproject/keccak256";
import { isHexString } from "@ethersproject/bytes";
import { id } from "@ethersproject/hash";
import InputToggle from "../../../../../components/InputToggle";

export const saltToHex = (salt: string | number) => {
  salt = salt.toString();
  if (isHexString(salt)) {
    return salt;
  }

  return id(salt);
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
  abiEncodedConstructorArguments,
}: {
  factoryAddress: string;
  salt: string | number;
  contractBytecode: string;
  abiEncodedConstructorArguments?: string;
}) {
  const initcode = contractBytecode + (abiEncodedConstructorArguments || "");
  if (initcode) {
    try {
      return buildCreate2Address(factoryAddress, saltToHex(salt), initcode);
    } catch (e) {
      return false;
    }
  } else {
    return false;
  }
}
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
  const [address, setAddress] = useState<string>();
  const [salt, setSalt] = useState<string>();
  const [abiEncodedConstructorArguments, setAbiEncodedConstructorArguments] =
    useState<string>("");
  const [create2Address, setcreate2Address] = useState<string>();

  const [isInvalidAddress, setIsInvalidAddress] = useState<boolean>(false);
  const [foundMatches, setFoundMatches] = useState<CheckAllByAddressResult>();
  const verifyButtonRef = useRef<HTMLButtonElement>(null);
  const [showRawAbiInput, setShowRawAbiInput] = useState(false);

  useEffect(() => {
    if (!address || !salt || !checkedContract?.creationBytecode) {
      return setcreate2Address(undefined);
    }
    const create2Address = getCreate2Address({
      factoryAddress: address,
      salt: salt,
      contractBytecode: checkedContract?.creationBytecode,
      abiEncodedConstructorArguments,
    });
    if (create2Address) {
      setcreate2Address(create2Address);
    } else {
      setcreate2Address(undefined);
    }
  }, [address, salt, checkedContract, abiEncodedConstructorArguments]);

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
      constructorArgs: abiEncodedConstructorArguments,
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
            {checkedContract.constructorArguments && (
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
                    checkedContract.constructorArguments
                  }
                  showRawAbiInput={showRawAbiInput}
                />
              </div>
            )}
          </div>

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

export default Create2Form;
