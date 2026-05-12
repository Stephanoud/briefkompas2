import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  characterCount?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, characterCount, className = "", id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-[var(--foreground)]">{label}</label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`px-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ring)] min-h-24 resize-none ${
            error ? "border-red-500" : "border-[var(--border)]"
          } ${className}`}
          {...props}
        />
        <div className="flex justify-between">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {characterCount !== undefined && (
            <span className="text-xs text-[var(--muted)] ml-auto">{characterCount} karakters</span>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
