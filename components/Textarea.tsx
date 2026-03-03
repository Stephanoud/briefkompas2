import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  characterCount?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, characterCount, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-gray-700">{label}</label>
        )}
        <textarea
          ref={ref}
          className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24 resize-none ${
            error ? "border-red-500" : "border-gray-300"
          } ${className}`}
          {...props}
        />
        <div className="flex justify-between">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {characterCount !== undefined && (
            <span className="text-xs text-gray-500 ml-auto">
              {characterCount} caractères
            </span>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
