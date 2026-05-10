export function ErrorMessage({ message }: { message: string }) {
  return <div className="bg-red-50 text-danger p-3 rounded-xl text-sm">{message}</div>;
}
