import { isAddress, getAddress } from "@ethersproject/address";
import { ChangeEventHandler, FormEventHandler, useState } from "react";
import Input from "../../components/Input";
import LoadingOverlay from "../../components/LoadingOverlay";
import Toast from "../../components/Toast";

type FieldProp = {
  loading: boolean;
  handleRequest: (address: string) => void;
};

const Field = ({ loading, handleRequest }: FieldProp) => {
  const [address, setAddress] = useState<any>("");
  const [error, setError] = useState<string>("");

  const checkAndSendRequest = (address: string) => {
    setAddress(address)
    if (!isAddress(address)) {
      setError("Invalid Address");
      return;
    }
    // Get checksummed format
    const checksummedAddress = getAddress(address);
    setAddress(checksummedAddress)
    handleRequest(checksummedAddress);
  }

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    checkAndSendRequest(address)
  };

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const newAddress = e.currentTarget.value;
    checkAndSendRequest(newAddress)
  };

  const handleExample = () => {
    const exampleAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // Uniswap
    checkAndSendRequest(exampleAddress);
  };

  return (
    <div className="flex flex-col py-16 px-12 flex-grow rounded-lg transition-all ease-in-out duration-300 bg-white overflow-hidden shadow-md">
      <div className="flex flex-col text-left relative">
        {loading && <LoadingOverlay message="Looking up the contract" />}
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="contract-address"
            className="font-bold mb-8 text-xl block text-center"
          >
            Contract Address
          </label>
          <Input
            id="contract-address"
            value={address}
            onChange={handleChange}
            placeholder="0xcaaf6B2ad74003502727e8b8Da046Fab40D6c035"
          />
          {!!error && (
            <Toast
              message={error}
              isShown={!!error}
              dismiss={() => setError("")}
            />
          )}{" "}
          <div className="flex justify-end">
            <button onClick={handleExample} className="text-gray-400">
              Example Contract
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Field;
