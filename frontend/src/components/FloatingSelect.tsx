"use client";

import React from "react";

type Option = { value: string | number; label: string };

type Props = {
  id: string;
  label: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  options: Option[];
  className?: string;
};

export default function FloatingSelect({ id, label, value, onChange, required, options, className = "" }: Props) {
  return (
    <div className="relative z-0">
      <select
        id={id}
        value={value as any}
        onChange={onChange}
        className={`block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer ${className}`}
        required={required}
      >
        {options.map((opt) => (
          <option key={`${opt.value}`} value={opt.value as any}>{opt.label}</option>
        ))}
      </select>
      <label
        htmlFor={id}
        className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600"
      >
        {label}
      </label>
    </div>
  );
}