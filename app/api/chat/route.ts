import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  stepCountIs,
  type UIMessage,
} from "ai";
import { allTools } from "@/lib/agent/tools";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";

export const maxDuration = 30; // Hobby. En Pro con Fluid Compute puedes subirlo.
export const runtime = "nodejs"; // los tools importan JSON del repo

// Límite defensivo. El endpoint cuesta dinero por invocación, por lo tanto no
// debe quedar abierto aunque el despliegue sea interno.
const MAX_MESSAGES = 40;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("empty request", { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return new Response("conversation too long", { status: 413 });
  }

  const result = streamText({
    // AI Gateway. No requiere @ai-sdk/anthropic ni una llave de Anthropic:
    // basta AI_GATEWAY_API_KEY en las variables de entorno del proyecto.
    model: "anthropic/claude-sonnet-4.6",
    system: AGENT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: allTools,
    // El agente encadena: consulta cobertura, luego el ticket, luego la
    // aplicación. Sin esto se queda en un solo paso y responde a medias.
    stopWhen: stepCountIs(8),
    // Sin temperature a proposito. Los modelos de respaldo declarados abajo,
    // Sonnet 5 y Opus 5, rechazan temperature / top_p / top_k con 400: el
    // parametro de muestreo desaparecio en esa familia. Con temperature: 0 el
    // respaldo nunca funciona, que es justamente lo que la lista de respaldo
    // existe para evitar. Lo que fija la conducta aqui es el system prompt y
    // el hecho de que toda cifra venga de una herramienta, no el sampler.
    providerOptions: {
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
      // Si el proveedor primario cae, Gateway enruta al siguiente.
      gateway: { models: ["anthropic/claude-sonnet-5", "anthropic/claude-opus-5"] },
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
