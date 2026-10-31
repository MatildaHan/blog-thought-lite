export function jsonResponse(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }
	});
}

/** Bound input before parsing so anonymous requests cannot allocate huge bodies. */
export async function readJson(request: Request, limit = 32000): Promise<unknown> {
	const reader = request.body?.getReader();
	if (!reader) throw new Error("invalid");
	const decoder = new TextDecoder();
	let size = 0;
	let body = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) throw new Error("too-large");
			body += decoder.decode(value, { stream: true });
		}
		return JSON.parse(body + decoder.decode());
	} finally {
		await reader.cancel();
	}
}
