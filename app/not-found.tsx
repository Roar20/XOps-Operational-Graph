import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card card-pad">
      <h1 className="text-lg font-semibold text-ink-900">No encontrado</h1>
      <p className="mt-1 text-sm text-ink-600">
        La aplicacion solicitada no existe en el corte actual del grafo.
      </p>
      <Link href="/" className="btn mt-3">Volver a Portfolio Health</Link>
    </div>
  );
}
