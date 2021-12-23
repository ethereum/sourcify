import React, { ChangeEventHandler, FormEventHandler, useState } from "react";
import Input from "../../../../../components/Input";
import NetworkSelect from "../../../../../components/NetworkSelect";
import { CHAIN_IDS_STR } from "../../../../../constants";
import {
  CheckAllByAddressResult,
  SendableContract,
  VerificationInput,
} from "../../../../../types";
import { checkAllByAddresses } from "../../../../../utils/api";
import Message from "./Message";

type ChainAddressFormProps = {
  customStatus: string;
  checkedContract: SendableContract;
  verifyCheckedContract: (sendable: VerificationInput) => void;
};
const ChainAddressForm = ({
  customStatus,
  checkedContract,
  verifyCheckedContract,
}: ChainAddressFormProps) => {
  const [address, setAddress] = useState<string>();
  const [isInvalidAddress, setIsInvalidAddress] = useState<boolean>(false);
  const [chainId, setChainId] = useState<string>();
  const [foundMatches, setFoundMatches] = useState<CheckAllByAddressResult>();

  const handleAddressChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const tempAddr = e.target.value;
    setAddress(tempAddr);
    const isValid = /^0x[0-9a-fA-F]{40}$/.test(tempAddr);
    if (!isValid) {
      setFoundMatches(undefined);
      return setIsInvalidAddress(true);
    }
    setIsInvalidAddress(false);
    checkAllByAddresses(tempAddr, CHAIN_IDS_STR).then((res) => {
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
    console.log(`New id is: ${newChainId}`);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!address || !chainId || isInvalidAddress) return;
    verifyCheckedContract({
      verificationId: checkedContract.verificationId || "",
      address: address || "",
      chainId: chainId,
    });
  };
  return (
    <div className="mt-4">
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
          />
        </div>
        <div>
          <label className="block" htmlFor="network-select">
            Network
          </label>
          <NetworkSelect
            id="network-select"
            value={chainId}
            handleChainIdChange={handleChainIdChange}
          />
        </div>
        <button
          type="submit"
          className="mt-4 py-2 px-4 w-full bg-ceruleanBlue-100 hover:bg-ceruleanBlue-130 focus:ring-ceruleanBlue-70 focus:ring-offset-ceruleanBlue-10 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default"
          disabled={!address || !chainId || isInvalidAddress}
        >
          Verify
        </button>
      </form>
    </div>
  );
};

export default ChainAddressForm;
