import { useEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import ReactTooltip from "react-tooltip";
import TextArea from "./TextArea";
import Input from "./Input";
import { defaultAbiCoder, ParamType } from "@ethersproject/abi";

interface ConstructorArgumentsProps {
  setAbiEncodedConstructorArguments: React.Dispatch<
    React.SetStateAction<string>
  >;
  abiEncodedConstructorArguments: string;
  abiJsonConstructorArguments: ParamType[];
  showRawAbiInput: boolean;
  setIsInvalidConstructorArguments: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}

interface ParamTypeWithValue extends ParamType {
  value?: string;
}

const InfoTooltip = () => (
  <span>
    <ReactTooltip
      effect="solid"
      delayHide={500}
      clickable={true}
      className="max-w-xl"
      id="abi-encoding-info"
    />
    <span
      className="ml-1 text-ceruleanBlue-200 font-bold"
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
        </div>
      )}
      data-html={true}
      data-for="abi-encoding-info"
    >
      ?
    </span>
  </span>
);

const ConstructorArguments = ({
  setAbiEncodedConstructorArguments,
  abiEncodedConstructorArguments,
  abiJsonConstructorArguments,
  showRawAbiInput,
  setIsInvalidConstructorArguments,
}: ConstructorArgumentsProps) => {
  const [userAbiJsonConstructorArguments, setUserAbiJsonConstructorArguments] =
    useState<ParamTypeWithValue[]>(abiJsonConstructorArguments);
  const [abiEncodingError, setAbiEncodingError] = useState<string>("");
  const [rawAbiError, setRawAbiError] = useState("");

  // should be invalid if there are any errors
  useEffect(() => {
    setIsInvalidConstructorArguments(!!abiEncodingError || !!rawAbiError);
  }, [abiEncodingError, rawAbiError, setIsInvalidConstructorArguments]);

  const handleRawAbiChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newRawAbi = e.target.value;
    setAbiEncodedConstructorArguments(newRawAbi);
    // nothing to validate
    if (newRawAbi === "") return setRawAbiError("");

    const trimmed = newRawAbi.startsWith("0x") ? newRawAbi.slice(2) : newRawAbi;

    // is hex string?
    if (!/^[A-F0-9]+$/i.test(trimmed)) {
      setRawAbiError(`Input is not a hex string`);
      setIsInvalidConstructorArguments(true);
      return;
    }

    if (trimmed.length % 64 !== 0) {
      setRawAbiError(
        `ABI encoding length must be a multiple of 64 (256 bits). Currently it is ${trimmed.length}`
      );
      setIsInvalidConstructorArguments(true);
      return;
    }
    setRawAbiError("");
  };

  const handleAbiJsonChange = (value: string, index: number) => {
    setUserAbiJsonConstructorArguments((prevUserAbiJson) => {
      const tempUserAbiJson = [...prevUserAbiJson];
      tempUserAbiJson[index].value = value;
      // Also update the abi encoding
      const types = tempUserAbiJson.map((argument) => argument.type);
      const values = tempUserAbiJson
        .map((argument) => argument.value)
        .filter((value) => !!value);
      try {
        if (values.length === 0) {
          setAbiEncodingError("");
          return tempUserAbiJson;
        }
        if (types.length !== values.length) {
          setAbiEncodingError("Please fill all the values");
          return tempUserAbiJson;
        }
        const newAbiEncoding = defaultAbiCoder.encode(types, values);
        setAbiEncodingError("");
        setAbiEncodedConstructorArguments(newAbiEncoding);
      } catch (e: any) {
        console.log(e);
        setAbiEncodingError("Encoding error: " + e.message);
        setIsInvalidConstructorArguments(true);
      }
      return tempUserAbiJson;
    });
  };

  if (!showRawAbiInput) {
    // ABI encode from the json for the user
    return (
      <div>
        <div className="flex flex-col">
          {/* <InputToggle onChange={() => setShowAbiJsonFields((prev) => !prev)} /> */}
          <div className="mt-4">
            <label className="block font-bold" htmlFor="argumentsForm">
              Constructor Arguments
            </label>
            <div className="text-xs text-gray-600">
              Enter each of the constructor arguments below to given fields. We
              will generate the ABI-encoding for you.
            </div>
          </div>
          {abiEncodingError && (
            <div className="text-lightCoral-600 break-all text-sm mt-2">
              {abiEncodingError}
            </div>
          )}
          <div className="ml-4" id="argumentsForm">
            {userAbiJsonConstructorArguments?.map((currentArgument, index) => (
              <div key={`constructor_${index}`} className="mt-2">
                <div className="flex justify-between">
                  <label className="block" htmlFor={currentArgument.name}>
                    {currentArgument.name} ({currentArgument.type})
                  </label>
                </div>
                <Input
                  id={currentArgument.name}
                  value={userAbiJsonConstructorArguments[index]?.value || ""}
                  onChange={(e) => handleAbiJsonChange(e.target.value, index)}
                  placeholder={currentArgument.type}
                  className="mb-2"
                />
              </div>
            ))}
            {abiEncodedConstructorArguments && (
              <div className="break-all mt-2">
                <label htmlFor="abiEncodingResult" className="flex-row flex">
                  ABI encoding: <InfoTooltip />
                </label>
                <TextArea
                  id="abiEncodingResult"
                  className="font-mono bg-gray-100 mb-2 h-32"
                  value={abiEncodedConstructorArguments}
                  disabled
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Direct ABI Encoded Input */}
      <div className="mt-2">
        <div className="mt-4 mb-2">
          <label
            className="flex flex-row items-center font-bold"
            htmlFor="rawConstructorArgs"
          >
            ABI-Encoded Constructor Arguments <InfoTooltip />
          </label>
        </div>
        {rawAbiError && (
          <div className="text-lightCoral-600 break-all text-sm mt-2">
            {rawAbiError}
          </div>
        )}
        <TextArea
          id="rawConstructorArgs"
          value={abiEncodedConstructorArguments}
          onChange={handleRawAbiChange}
          placeholder="00000000000000000000000000000000d41867734bbee4c6863d9255b2b06ac1000000000000000000000000000000000000000000000000000000000001e240..."
          className="mb-2 h-32"
        />
      </div>
    </div>
  );
};

export default ConstructorArguments;
