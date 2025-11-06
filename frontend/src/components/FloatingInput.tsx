"use client";

import React from "react";

type Props = {
  id: string;
  label: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  autoComplete?: string;
  className?: string;
};

export default function FloatingInput({ id, label, type = "text", value, onChange, required, autoComplete = "off", className = "" }: Props) {
  return (
    <div className="relative z-0">
      <input
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        placeholder=" "
        autoComplete={autoComplete}
        className={`block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer ${className}`}
        required={required}
      />
      <label
        htmlFor={id}
        className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600"
      >
        {label}
      </label>
    </div>
  );
}