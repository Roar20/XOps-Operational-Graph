import { handleInsightRequest } from "@/lib/agent/insights/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  return handleInsightRequest(body);
}
