import React, { ChangeEventHandler } from "react";

type InputProps = {
  onChange?: ChangeEventHandler<HTMLInputElement>;
  value?: string | number;
  className?: string;
  type?: string;
  placeholder?: string;
  id?: string;
};

const Input: React.FC<InputProps> = ({
  type = "text",
  onChange,
  value,
  placeholder,
  className,
  id,
}) => {
  return (
    <input
      className={
        "mb-4 w-full rounded-md border-2 border-ceruleanBlue-200 bg-gray-50 px-4 py-2 " +
        className
      }
      id={id}
      type={type}
      placeholder={placeholder}
      onChange={onChange}
      value={value}
    />
  );
};

export default Input;
