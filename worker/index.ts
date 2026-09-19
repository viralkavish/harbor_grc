/**
 * Cloudflare Worker for Harbor GRC
 * Custom domain: harbor.vdesai.com
 */

export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          version: "0.1.0",
          platform: "cloudflare-workers",
          subdomain: "harbor.vdesai.com"
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Serve static client assets (HTML/CSS/JS/SVG)
    if (env.ASSETS) {
      return await env.ASSETS.fetch(request);
    }

    return new Response("Harbor GRC Worker active.", { status: 200 });
  }
};
