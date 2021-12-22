import React, { ChangeEventHandler, useState } from "react";
import Input from "../../../../components/Input";
import NetworkSelect from "../../../../components/NetworkSelect";
import { SendableContract, VerificationInput } from "../../../../types";

type MessageProps = {
  status: string;
  chainId: string | undefined;
  address: string | undefined;
};
const Message: React.FC<MessageProps> = ({ status, chainId, address }) => {
  if (status === "perfect" || status === "partial") {
    return (
      <p>
        Contract {status}ly verified at <b>{chainId}</b>:{address}
      </p>
    );
  }
  if (status === "chainAddress") {
    return <p>Please provide contract address and network </p>;
  }
  return null;
};

type ChainAddressMissingProps = {
  status: string;
  checkedContract: SendableContract;
  verifyCheckedContract: (sendable: VerificationInput) => void;
};
const ChainAddressMissing: React.FC<ChainAddressMissingProps> = ({
  status,
  checkedContract,
  verifyCheckedContract,
}) => {
  const [address, setAddress] = useState<string>();
  const [chainId, setChainId] = useState<string>();

  const handleAddressChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setAddress(e.target.value);
    verifyCheckedContract({
      verificationId: checkedContract.verificationId || "",
      address: e.target.value,
      chainId: chainId || "",
    });
  };

  const handleChainIdChange = (newChainId: number) => {
    const newChainIdStr = newChainId.toString();
    setChainId(newChainIdStr);
    console.log(`New id is: ${newChainId}`);
    verifyCheckedContract({
      verificationId: checkedContract.verificationId || "",
      address: address || "",
      chainId: newChainIdStr,
    });
  };

  return (
    <div className="mt-4">
      <div className="">
        <Message
          status={status}
          chainId={checkedContract.chainId}
          address={checkedContract.address}
        />
      </div>
      <form className="mt-4">
        <div>
          <label className="block">Address</label>
          <Input
            value={address}
            onChange={handleAddressChange}
            placeholder="0x2fabe97..."
          />
        </div>
        <div>
          <label className="block">Network</label>
          <NetworkSelect
            value={chainId}
            handleChainIdChange={handleChainIdChange}
          />
        </div>
      </form>
    </div>
  );
};

export default ChainAddressMissing;
