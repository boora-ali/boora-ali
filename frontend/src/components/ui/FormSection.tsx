import type { ReactNode } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/80 p-3">
      <div>
        <h2 className="font-fraunces text-lg font-semibold leading-tight text-text">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
