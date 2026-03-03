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
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
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
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      <div
        onClick={handleClick}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          error
            ? "border-red-500 bg-red-50"
            : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-8 h-8 text-gray-400"
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
            <p className="text-sm font-medium text-gray-700">
              Sleep bestanden hier of
            </p>
            <p className="text-sm text-blue-600">klik om te kiezen</p>
          </div>
          <p className="text-xs text-gray-500">
            PDF tot {(maxSize / 1024 / 1024).toFixed(0)}MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {uploadedFiles.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Geüploade bestanden:
          </p>
          <ul className="space-y-1">
            {uploadedFiles.map((file) => (
              <li
                key={file.path}
                className="text-sm text-gray-600 flex items-center gap-2"
              >
                <span className="w-4 h-4 bg-green-500 rounded-full"></span>
                {file.name} ({(file.size / 1024).toFixed(0)}KB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
