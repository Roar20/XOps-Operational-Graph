import { handleInsightRequest } from "@/lib/agent/insights/handler";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  return handleInsightRequest(body);
}
