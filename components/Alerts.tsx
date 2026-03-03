import React from "react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "info" | "warning" | "error" | "success";
  title?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = "info",
  title,
  children,
  className = "",
  ...props
}) => {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-green-50 border-green-200 text-green-800",
  };

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    success: "✓",
  };

  return (
    <div
      className={`border rounded-lg p-4 ${styles[type]} ${className}`}
      {...props}
    >
      <div className="flex gap-3">
        <span className="text-xl">{icons[type]}</span>
        <div>
          {title && <p className="font-semibold">{title}</p>}
          <p className="text-sm">{children}</p>
        </div>
      </div>
    </div>
  );
};

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
};

interface StepHeaderProps {
  currentStep: number;
  totalSteps: number;
  title: string;
}

export const StepHeader: React.FC<StepHeaderProps> = ({
  currentStep,
  totalSteps,
  title,
}) => {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span className="text-sm text-gray-600">
          Stap {currentStep} van {totalSteps}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};
