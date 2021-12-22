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
        "mb-4 w-full rounded-md border-2 border-gray-400 px-2 py-1.5 " +
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
