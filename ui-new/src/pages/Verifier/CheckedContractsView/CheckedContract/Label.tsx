import React from "react";

type LabelProps = {
  customStatus: string;
};

interface ILABELS {
  [key: string]: string;
}
const LABELS: ILABELS = {
  perfect: "Perfect Match",
  partial: "Partial Match",
  missing: "Files Missing",
  invalid: "Invalid Files",
  error: "Chain & Address Missing",
};

const Label: React.FC<LabelProps> = ({ customStatus }) => {
  return (
    <span className="px-3 py-2 mr-2 bg-gray-400 text-gray-800 text-xs rounded-full">
      {LABELS[customStatus]}
    </span>
  );
};

export default Label;
