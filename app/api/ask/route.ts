import { isAddress } from "viem";
import { askAgent } from "@/lib/ai/qa";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import type { Address, AgentAnswer, ApiResponse } from "@/lib/types";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 400;
const MAX_BODY_BYTES = 64 * 1024;

interface AskBody {
  address?: unknown;
  question?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "ask", RATE_LIMITS.write);
  if (rateLimited) return rateLimited;

  const cl = Number(request.headers.get("content-length") || 0);
  if (cl > MAX_BODY_BYTES) {
    return Response.json(
      { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large (max 64KB)." } } as ApiResponse<AgentAnswer>,
      { status: 413 }
    );
  }

  const bad = (message: string, status = 400): Response =>
    Response.json(
      { success: false, error: { code: "INVALID_PARAMS", message } } as ApiResponse<AgentAnswer>,
      { status }
    );

  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return bad("Request body must be valid JSON.");
  }

  if (typeof body.address !== "string" || !isAddress(body.address)) {
    return bad("address must be a valid 0x address.");
  }
  if (typeof body.question !== "string" || body.question.trim().length === 0) {
    return bad("question must be a non-empty string.");
  }
  const question = body.question.trim().slice(0, MAX_QUESTION_LENGTH);

  try {
    const answer = await askAgent(body.address as Address, question);
    return Response.json({ success: true, data: answer } satisfies ApiResponse<AgentAnswer>);
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "AGENT_UNAVAILABLE", message: "The agent could not answer right now. Please try again." },
      } as ApiResponse<AgentAnswer>,
      { status: 502 }
    );
  }
}