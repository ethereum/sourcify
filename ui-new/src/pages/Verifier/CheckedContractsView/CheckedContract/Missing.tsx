import React from "react";
import { SendableContract } from "../../../../types";

type MissingProps = {
  checkedContract: SendableContract;
};

const Missing: React.FC<MissingProps> = ({ checkedContract }) => {
  const totalContracts =
    checkedContract.files.found.length +
    checkedContract.files.missing.length +
    Object.keys(checkedContract.files.invalid).length;
  return (
    <div>
      <p>
        {checkedContract.files.missing.length} out of {totalContracts} source
        files missing. Please add the files in the add file zone
      </p>
      <ul className="mt-4">
        {checkedContract.files.missing.map((fileName, i) => (
          <li key={i + "-" + fileName}>{fileName}</li>
        ))}
      </ul>
    </div>
  );
};

export default Missing;
