import NextAuth from "next-auth";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const handler = NextAuth(authOptions);

type NextAuthRouteContext = {
  params: {
    nextauth: string[];
  };
};

async function runAuthHandler(request: Request, context: NextAuthRouteContext, route: string) {
  const rateLimitResult = enforceApiRateLimit({
    request,
    route
  });
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }

  const response = await handler(request, context);
  return withApiRateLimitHeaders(response, rateLimitResult.state);
}

export async function GET(request: Request, context: NextAuthRouteContext) {
  return runAuthHandler(request, context, "auth:get");
}

export async function POST(request: Request, context: NextAuthRouteContext) {
  return runAuthHandler(request, context, "auth:post");
}
