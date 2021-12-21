import React, { ChangeEventHandler, useState } from "react";
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

  const handleChainIdChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setChainId(e.target.value);
    verifyCheckedContract({
      verificationId: checkedContract.verificationId || "",
      address: address || "",
      chainId: e.target.value,
    });
  };
  return (
    <div>
      <Message
        status={status}
        chainId={checkedContract.chainId}
        address={checkedContract.address}
      />
      <form>
        <div>
          <label className="block">Address</label>
          <input value={address} onChange={handleAddressChange} />
        </div>
        <div>
          <label className="block">Network</label>
          <input value={chainId} onChange={handleChainIdChange} />
        </div>
      </form>
    </div>
  );
};

export default ChainAddressMissing;
