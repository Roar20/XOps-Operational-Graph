import { AgentChat } from "@/components/AgentChat";

export const metadata = { title: "Operational Agent · XOps Operational Graph" };

/* Ruta propia, la opcion que AGENT_SETUP.md nombra. No se agrega a Nav.tsx a
   proposito: donde vive el agente es decision de producto, y las ocho pantallas
   del tablero no cambian por esto. Para colgarlo de la navegacion basta con
   agregar { href: "/agent", label: "Agent" } a LINKS en components/Nav.tsx. */
export default function AgentPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-pep-900">Operational Agent</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-700">
          Reads the verified aggregates from this repository and, when a corpus is loaded
          in this browser, the ticket-level detail. It answers only from what its tools
          return: every figure carries a denominator, a source and a cut-off date, and a
          measure that is blocked stays blocked.
        </p>
      </div>
      <div className="h-[680px]">
        <AgentChat />
      </div>
    </div>
  );
}
