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
    info: "bg-cyan-50 border-cyan-200 text-cyan-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-red-50 border-red-200 text-red-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };

  const labels = {
    info: "INFO",
    warning: "LET OP",
    error: "FOUT",
    success: "OK",
  };

  return (
    <div className={`border rounded-xl p-4 ${styles[type]} ${className}`} {...props}>
      <div className="flex gap-3">
        <span className="text-xs font-bold mt-1">{labels[type]}</span>
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
      <div className="w-8 h-8 border-4 border-[var(--border)] border-t-[var(--brand)] rounded-full animate-spin"></div>
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
        <h2 className="text-xl text-[var(--foreground)]">{title}</h2>
        <span className="text-sm text-[var(--muted)]">
          Stap {currentStep} van {totalSteps}
        </span>
      </div>
      <div className="w-full bg-[var(--surface-soft)] rounded-full h-2">
        <div
          className="bg-[var(--brand)] h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};
