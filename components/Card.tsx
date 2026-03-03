import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ title, subtitle, children, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white rounded-lg border border-gray-200 shadow-sm p-6 ${className}`}
        {...props}
      >
        {title && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
