import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--foreground)]">{label}</label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`px-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
            error ? "border-red-500" : "border-[var(--border)]"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
