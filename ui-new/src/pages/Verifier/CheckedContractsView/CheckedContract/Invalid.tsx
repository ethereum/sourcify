import React from "react";
import { SendableContract } from "../../../../types";

type InvalidProps = {
  checkedContract: SendableContract;
};

const Invalid: React.FC<InvalidProps> = ({ checkedContract }) => {
  const { files } = checkedContract;
  const invalidCount = Object.keys(files.invalid).length;
  const totalContracts =
    files.found.length + Object.keys(files.missing).length + invalidCount;
  return (
    <div>
      <p>
        {invalidCount} out of {totalContracts} source files don't have the
        expected hashes. Please provide the correct files on the add file zone.
      </p>
      <ul className="mt-4">
        {Object.keys(files.missing).map((filePath, i) => (
          <li key={i + "-" + filePath}>{filePath}</li>
        ))}
      </ul>
    </div>
  );
};

export default Invalid;
