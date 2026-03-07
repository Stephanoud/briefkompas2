import React, { useRef } from "react";
import { UploadedFileRef } from "@/types";

interface UploadBoxProps {
  label?: string;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onFileSelect: (files: File[]) => void;
  uploadedFiles?: UploadedFileRef[];
  error?: string;
  required?: boolean;
  helperText?: string;
  actionText?: string;
  descriptionText?: string;
  disabled?: boolean;
  capture?: "user" | "environment";
}

export const UploadBox: React.FC<UploadBoxProps> = ({
  label = "Upload bestanden",
  accept = ".pdf",
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  onFileSelect,
  uploadedFiles = [],
  error,
  required = false,
  helperText,
  actionText = "klik om te kiezen",
  descriptionText = "Sleep bestanden hier of",
  disabled = false,
  capture,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        console.error(`File ${file.name} exceeds max size`);
        return false;
      }
      return true;
    });
    onFileSelect(validFiles);
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      <div
        onClick={handleClick}
        aria-disabled={disabled}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-soft)]/60 opacity-75"
            : "cursor-pointer"
        } ${error ? "border-red-500 bg-red-50" : "border-[var(--border)] bg-white hover:border-[var(--ring)] hover:bg-[var(--surface-soft)]/60"}`}
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            className="h-8 w-8 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">{descriptionText}</p>
            <p className="text-sm text-[var(--brand)]">{disabled ? "Bezig met analyseren..." : actionText}</p>
          </div>
          <p className="text-xs text-[var(--muted)]">Bestanden tot {(maxSize / 1024 / 1024).toFixed(0)}MB</p>
          {helperText && <p className="max-w-md text-xs leading-relaxed text-[var(--muted)]">{helperText}</p>}
        </div>

        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          capture={capture}
          disabled={disabled}
          onChange={handleChange}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {uploadedFiles.length > 0 && (
        <div className="mt-2">
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Geuploade bestanden:</p>
          <ul className="space-y-1">
            {uploadedFiles.map((file) => (
              <li key={file.path} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <span className="h-4 w-4 rounded-full bg-[var(--accent)]"></span>
                {file.name} ({(file.size / 1024).toFixed(0)}KB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
