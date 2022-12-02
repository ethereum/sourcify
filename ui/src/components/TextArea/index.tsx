import React, { ChangeEventHandler } from "react";

type TextAreaProps = {
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  value?: string | number;
  className?: string;
  type?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

const TextArea: React.FC<TextAreaProps> = ({
  type = "text",
  onChange,
  value,
  placeholder,
  className,
  id,
  disabled,
}) => {
  return (
    <textarea
      className={
        "w-full rounded-md border-2 border-ceruleanBlue-200 bg-gray-50 px-4 py-2 h-24 disabled:opacity-30" +
        className
      }
      id={id}
      placeholder={placeholder}
      onChange={onChange}
      value={value}
      disabled={disabled}
    />
  );
};

export default TextArea;
