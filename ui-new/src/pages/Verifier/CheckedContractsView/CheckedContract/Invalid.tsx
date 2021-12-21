import React from "react";
import { SendableContract } from "../../../../types";

type InvalidProps = {
  checkedContract: SendableContract;
};

const Invalid: React.FC<InvalidProps> = ({ checkedContract }) => {
  const totalContracts =
    checkedContract.files.found.length +
    checkedContract.files.missing.length +
    Object.keys(checkedContract.files.invalid).length;
  return (
    <div>
      <p>
        {checkedContract.files.invalid.length} out of {totalContracts} source
        files don't have the expected hashes. Please provide the correct files
        on the add file zone.
      </p>
      <ul className="mt-4">
        {checkedContract.files.missing.map((fileName, i) => (
          <li key={i + "-" + fileName}>{fileName}</li>
        ))}
      </ul>
    </div>
  );
};

export default Invalid;
