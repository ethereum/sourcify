import React from "react";
import { SendableContract } from "../../../../types";

type MissingProps = {
  checkedContract: SendableContract;
};

const Missing: React.FC<MissingProps> = ({ checkedContract }) => {
  const { files } = checkedContract;
  const missingCount = Object.keys(files.missing).length;
  const totalContracts =
    files.found.length + missingCount + Object.keys(files.invalid).length;
  return (
    <div>
      <p>
        {missingCount} out of {totalContracts} source files missing. Please add
        the files in the add file zone
      </p>
      {/* <ul className="mt-4">
        {Object.keys(files.missing).map((filePath, i) => (
          <li key={i + "-" + filePath}>{filePath}</li>
        ))}
      </ul> */}
    </div>
  );
};

export default Missing;
