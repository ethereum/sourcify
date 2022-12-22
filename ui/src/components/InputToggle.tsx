import { ButtonHTMLAttributes } from "react";

interface InputToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  isChecked?: boolean;
}

const InputToggle = ({
  label,
  className,
  isChecked = false,
  ...props
}: InputToggleProps) => {
  return (
    <button
      className={`cursor-pointer flex flex-row items-center ${className}`}
      {...props}
      type="button"
    >
      <div className="relative">
        <div
          className={`h-5 w-10 rounded-full ${
            isChecked ? "bg-ceruleanBlue-200" : "bg-gray-200"
          } shadow-inner`}
        ></div>
        <div
          className={`absolute ${
            isChecked
              ? "bg-ceruleanBlue-500 translate-x-5"
              : "bg-ceruleanBlue-200"
          } left-0 top-0 h-5 w-5 rounded-full transition`}
        ></div>
      </div>
      <label className="ml-2">{label}</label>
    </button>
  );
};

export default InputToggle;
