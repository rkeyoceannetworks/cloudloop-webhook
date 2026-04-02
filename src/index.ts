export interface Env {
	cloudloop_db: D1Database;
	WEBHOOK_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/webhook" && request.method === "POST") {
			
			// --- SECURITY CHECK START ---
			// We check BOTH the headers and the URL for the password
			const headerSecret = request.headers.get("X-Webhook-Secret");
			const urlSecret = url.searchParams.get("token");
			
			if (headerSecret !== env.WEBHOOK_SECRET && urlSecret !== env.WEBHOOK_SECRET) {
				return new Response(JSON.stringify({ error: "Unauthorized: Invalid Secret" }), { 
					status: 401, 
					headers: { "Content-Type": "application/json" } 
				});
			}
			// --- SECURITY CHECK END ---

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

		return new Response("Not found", { status: 404 });
	},
};
