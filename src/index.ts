export interface Env {
	cloudloop_db: D1Database;
	WEBHOOK_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// ... (Keep Route 1: /webhook as it is) ...

		// UPDATED ROUTE 2: Searchable API for External Servers
		if (url.pathname === "/api/data" && request.method === "GET") {
			const apiKey = request.headers.get("X-API-Key") || url.searchParams.get("token");

			if (apiKey !== env.WEBHOOK_SECRET) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
			}

			// 1. Grab filters from the URL
			const deviceId = url.searchParams.get("device_id");
			const startDate = url.searchParams.get("start_date"); // Format: YYYY-MM-DD
			const endDate = url.searchParams.get("end_date");     // Format: YYYY-MM-DD

			try {
				// 2. Build a dynamic SQL query
				let query = "SELECT * FROM cloudloop_data WHERE 1=1";
				const params: any[] = [];

				if (deviceId) {
					// We use LIKE so it's a bit more flexible with IDs
					query += " AND raw_payload LIKE ?"; 
					params.push(`%${deviceId}%`);
				}

				if (startDate) {
					query += " AND received_at >= ?";
					params.push(`${startDate} 00:00:00`);
				}

				if (endDate) {
					query += " AND received_at <= ?";
					params.push(`${endDate} 23:59:59`);
				}

				query += " ORDER BY received_at DESC LIMIT 500";

				// 3. Execute the filtered search
				const { results } = await env.cloudloop_db.prepare(query).bind(...params).all();

				return new Response(JSON.stringify(results), {
					status: 200, headers: { "Content-Type": "application/json" }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: "Search failed" }), { status: 500 });
			}
		}

		// ... (Keep Route 3: /data for the dashboard) ...

		return new Response("Not found", { status: 404 });
	},
};
