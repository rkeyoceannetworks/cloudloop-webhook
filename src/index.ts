export interface Env {
	cloudloop_db: D1Database;
	WEBHOOK_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// --- ROUTE 1: WEBHOOK INGEST (POST) ---
		if (url.pathname === "/webhook" && request.method === "POST") {
			const auth = request.headers.get("X-Webhook-Secret") || url.searchParams.get("token");
			if (auth !== env.WEBHOOK_SECRET) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
			}

			try {
				const payload = await request.json();
				const payloadString = JSON.stringify(payload);
				await env.cloudloop_db.prepare(
					"INSERT INTO cloudloop_data (raw_payload) VALUES (?)"
				).bind(payloadString).run();

				return new Response(JSON.stringify({ status: "success" }), { status: 200 });
			} catch (e) {
				return new Response(JSON.stringify({ error: "Ingest failed" }), { status: 400 });
			}
		}

		// --- ROUTE 2: EXTERNAL API (GET with Search/Filters) ---
		if (url.pathname === "/api/data" && request.method === "GET") {
			const auth = request.headers.get("X-API-Key") || url.searchParams.get("token");
			if (auth !== env.WEBHOOK_SECRET) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
			}

			const deviceId = url.searchParams.get("device_id");
			const startDate = url.searchParams.get("start_date");
			const endDate = url.searchParams.get("end_date");

			let query = "SELECT * FROM cloudloop_data WHERE 1=1";
			const params: any[] = [];

			if (deviceId) { query += " AND raw_payload LIKE ?"; params.push(`%${deviceId}%`); }
			if (startDate) { query += " AND received_at >= ?"; params.push(`${startDate} 00:00:00`); }
			if (endDate) { query += " AND received_at <= ?"; params.push(`${endDate} 23:59:59`); }
			query += " ORDER BY received_at DESC LIMIT 500";

			const { results } = await env.cloudloop_db.prepare(query).bind(...params).all();
			return new Response(JSON.stringify(results), { 
				status: 200, 
				headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
			});
		}

		// --- ROUTE 3: DASHBOARD DATA (GET - Public for your Browser) ---
		if (url.pathname === "/data" && request.method === "GET") {
			try {
				const { results } = await env.cloudloop_db.prepare(
					"SELECT * FROM cloudloop_data ORDER BY received_at DESC LIMIT 50"
				).all();
				return new Response(JSON.stringify(results), { 
					status: 200, 
					headers: { 
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*" // Allows your dashboard to "see" the data
					} 
				});
			} catch (e) {
				return new Response(JSON.stringify({ error: "DB Error" }), { status: 500 });
			}
		}

		return new Response("Not found", { status: 404 });
	},
};
