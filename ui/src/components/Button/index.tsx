import { MouseEventHandler, ReactElement } from "react";

type ButtonProps = {
  children: ReactElement | string;
  type?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};
const Button = ({ children, type, className, onClick }: ButtonProps) => {
  let bg = "bg-ceruleanBlue-500";
  let hoverBg = "hover:bg-ceruleanBlue-600";
  let textColor = "text-white";

  if (type === "secondary") {
    bg = "bg-ceruleanBlue-100";
    hoverBg = "hover:bg-ceruleanBlue-200";
    textColor = "text-ceruleanBlue-500";
  } else if (type === "white") {
    bg = "bg-slate-50";
    hoverBg = "hover:bg-slate-200";
    textColor = "text-slate-900";
  }

  return (
    <button
      className={`py-3 px-4 ${bg} ${hoverBg} disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 ${textColor} transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
