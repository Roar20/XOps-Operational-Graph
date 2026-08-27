import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card card-pad">
      <h1 className="text-lg font-semibold text-ink-900">Not found</h1>
      <p className="mt-1 text-sm text-ink-600">
        The requested application does not exist in the current cut of the graph.
      </p>
      <Link href="/" className="btn mt-3">Back to Portfolio Health</Link>
    </div>
  );
}
