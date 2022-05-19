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

const LABEL_BG: ILABELS = {
  perfect: "bg-green-200",
  partial: "bg-partialMatch-200",
  missing: "bg-red-200",
  invalid: "bg-red-200",
  error: "bg-yellow-200",
};

const LABEL_TEXT: ILABELS = {
  perfect: "text-green-800",
  partial: "text-partialMatch-800",
  missing: "text-red-800",
  invalid: "text-red-800",
  error: "text-yellow-800",
};

const Label: React.FC<LabelProps> = ({ customStatus }) => {
  return (
    <span
      className={
        `px-3 py-2 mr-2 text-xs rounded-full  ` +
        LABEL_BG[customStatus] +
        " " +
        LABEL_TEXT[customStatus]
      }
      // className={`px-3 py-2 mr-2 bg-opacity-70 bg-${LABEL_BG[customStatus]} text-${LABEL_TEXT[customStatus]}  text-xs rounded-full`}
    >
      {LABELS[customStatus]}
    </span>
  );
};

export default Label;
