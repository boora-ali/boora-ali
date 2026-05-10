export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-16 animate-fade-in">
      <div className="text-5xl mb-4 opacity-30">🍽</div>
      <h3 className="font-fraunces text-xl font-semibold text-text">{title}</h3>
      {description && <p className="text-muted mt-2 text-sm">{description}</p>}
    </div>
  );
}
