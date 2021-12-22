import React from "react";

type LabelProps = {
  status: string;
};

interface ILABELS {
  [key: string]: string;
}
const LABELS: ILABELS = {
  perfect: "Perfect Match",
  partial: "Partial Match",
  missing: "Files Missing",
  invalid: "Invalid Files",
  chainAddress: "Chain & Address Missing",
  error: "Unknown Error",
};

const Label: React.FC<LabelProps> = ({ status }) => {
  return (
    <span className="px-3 py-2 mr-2 bg-gray-400 text-gray-800 text-xs rounded-full">
      {LABELS[status]}
    </span>
  );
};

export default Label;
