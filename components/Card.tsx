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
        className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[0_12px_30px_rgba(17,33,28,0.06)] p-6 ${className} max-w-full`}
        {...props}
      >
        {title && (
          <div className="mb-4">
            <h3 className="text-xl text-[var(--foreground)]">{title}</h3>
            {subtitle && <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
