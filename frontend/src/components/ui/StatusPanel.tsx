import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function StatusPanel({ icon, title, description, actions, className = "" }: Props) {
  return (
    <div className={`max-w-sm w-full text-center space-y-6 ${className}`.trim()}>
      <div className="flex justify-center">{icon}</div>
      <div className="space-y-2">
        <h1 className="font-fraunces text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
