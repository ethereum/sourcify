import React, { ChangeEventHandler } from "react";

type InputProps = {
  onChange?: ChangeEventHandler<HTMLInputElement>;
  value?: string | number;
  className?: string;
  type?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

const Input: React.FC<InputProps> = ({
  type = "text",
  onChange,
  value,
  placeholder,
  className,
  id,
  disabled,
}) => {
  return (
    <input
      className={
        "w-full rounded-md border-2 border-ceruleanBlue-200 bg-gray-50 px-4 h-11 disabled:opacity-30 " +
        className
      }
      id={id}
      type={type}
      placeholder={placeholder}
      onChange={onChange}
      value={value}
      disabled={disabled}
    />
  );
};

export default Input;
