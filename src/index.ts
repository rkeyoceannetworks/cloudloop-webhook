export interface Env {
	cloudloop_db: D1Database;
	WEBHOOK_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// ROUTE 1: Receive POST webhooks from Cloudloop (Ingest)
		if (url.pathname === "/webhook" && request.method === "POST") {
			const headerSecret = request.headers.get("X-Webhook-Secret");
			const urlSecret = url.searchParams.get("token");
			
			if (headerSecret !== env.WEBHOOK_SECRET && urlSecret !== env.WEBHOOK_SECRET) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
			}

			try {
				const payload = await request.json();
				const payloadString = JSON.stringify(payload);

				const { success } = await env.cloudloop_db.prepare(
					"INSERT INTO cloudloop_data (raw_payload) VALUES (?)"
				).bind(payloadString).run();

				if (success) {
					return new Response(JSON.stringify({ status: "success" }), {
						status: 200, headers: { "Content-Type": "application/json" }
					});
				} else {
					throw new Error("DB Insert Failed");
				}
			} catch (error) {
				return new Response(JSON.stringify({ status: "error" }), { status: 400 });
			}
		}

		// ROUTE 2: Secure API for external servers to pull data (Egress)
		if (url.pathname === "/api/data" && request.method === "GET") {
			// Require the same secret password, but let them pass it as 'X-API-Key'
			const apiKey = request.headers.get("X-API-Key");
			const urlToken = url.searchParams.get("token");

			if (apiKey !== env.WEBHOOK_SECRET && urlToken !== env.WEBHOOK_SECRET) {
				return new Response(JSON.stringify({ error: "Unauthorized: Invalid API Key" }), { 
					status: 401, headers: { "Content-Type": "application/json" } 
				});
			}

			try {
				// Fetch the latest 100 records for the external server
				const { results } = await env.cloudloop_db.prepare(
					"SELECT * FROM cloudloop_data ORDER BY received_at DESC LIMIT 100"
				).all();

				return new Response(JSON.stringify(results), {
					status: 200, headers: { "Content-Type": "application/json" }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: "Database fetch failed" }), { status: 500 });
			}
		}

		// ROUTE 3: Serve the HTML Dashboard's data (Unprotected so your browser can view it easily)
		if (url.pathname === "/data" && request.method === "GET") {
			try {
				const { results } = await env.cloudloop_db.prepare(
					"SELECT * FROM cloudloop_data ORDER BY received_at DESC LIMIT 50"
				).all();

				return new Response(JSON.stringify(results), {
					status: 200, headers: { "Content-Type": "application/json" }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: "Fetch failed" }), { status: 500 });
			}
		}

		// Fallback
		return new Response("Not found", { status: 404 });
	},
};
