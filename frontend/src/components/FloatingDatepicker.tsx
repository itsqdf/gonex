"use client";

import React from "react";
import { Datepicker } from "flowbite-react";

type Props = {
  id: string;
  label: string;
  className?: string;
  value?: Date | null;
  onChange?: (val: unknown) => void;
};

export default function FloatingDatepicker({ id, label, className = "", value, onChange }: Props) {
  const dpTheme = {
    root: {
      input: {
        addon: "inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-white px-3 text-sm text-black",
        field: {
          input: {
            base: "peer block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
            sizes: { md: "" },
            colors: {
              gray: "border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-600 focus:ring-blue-600 dark:border-gray-300 dark:bg-white dark:text-black dark:placeholder-gray-500 dark:focus:border-blue-600 dark:focus:ring-blue-600",
            },
            withIcon: { on: "pl-10", off: "" },
            withRightIcon: { on: "pr-10", off: "" },
            withAddon: { on: "rounded-r-lg", off: "rounded-lg" },
            withShadow: { on: "", off: "" },
          },
          icon: { svg: "h-5 w-5 text-gray-500" },
        },
      },
    },
    popup: {
      root: { inner: "inline-block rounded-lg bg-white p-4 shadow-lg z-50" },
      header: {
        title: "px-2 py-3 text-center font-semibold text-black",
        selectors: { button: { base: "rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white focus:outline-none" } },
      },
    },
    views: {
      days: {
        header: { title: "h-6 text-center text-sm font-medium leading-6 text-gray-700" },
        items: { item: { base: "block flex-1 cursor-pointer rounded-lg text-center text-sm font-semibold leading-9 text-black hover:bg-white", selected: "bg-blue-600 text-white hover:bg-blue-600", disabled: "text-gray-400" } },
      },
      months: { items: { item: { base: "block flex-1 cursor-pointer rounded-lg text-center text-sm font-semibold leading-9 text-black hover:bg-white", selected: "bg-blue-600 text-white hover:bg-blue-600", disabled: "text-gray-400" } } },
      years: { items: { item: { base: "block flex-1 cursor-pointer rounded-lg text-center text-sm font-semibold leading-9 text-black hover:bg-white", selected: "bg-blue-600 text-white hover:bg-blue-600", disabled: "text-gray-400" } } },
      decades: { items: { item: { base: "block flex-1 cursor-pointer rounded-lg text-center text-sm font-semibold leading-9 text-black hover:bg-white", selected: "bg-blue-600 text-white hover:bg-blue-600", disabled: "text-gray-400" } } },
    },
  };

  return (
    <div className="relative z-20">
      <Datepicker id={id} className={`w-full ${className}`} theme={dpTheme as any} value={value as any} onChange={onChange as any} />
      <label
        htmlFor={id}
        className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600"
      >
        {label}
      </label>
    </div>
  );
}