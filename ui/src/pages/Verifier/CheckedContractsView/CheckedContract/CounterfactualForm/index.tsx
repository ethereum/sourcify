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
  const [address, setAddress] = useState<string>();
  const [salt, setSalt] = useState<string>();
  const [constructorArgs, setConstructorArgs] = useState<ConstructorArgs[]>([]);

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
    if (checkedContract.constructorArguments) {
      setConstructorArgs(
        checkedContract.constructorArguments.map((arg: any) => ({
          type: arg.type,
          value: "",
        }))
      );
    }
  }, [setAddress, setConstructorArgs, checkedContract]);

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
            {checkedContract.constructorArguments.map((args, index) => (
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
        <button
          ref={verifyButtonRef}
          type="submit"
          className="mt-4 py-2 px-4 w-full bg-ceruleanBlue-500 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default "
          disabled={!address || isInvalidAddress}
        >
          Verify
        </button>
        <div className="mt-5">
          <strong>Address:</strong> {checkedContract.address}
        </div>
      </form>
    </div>
  );
};

export default CounterfactualForm;
