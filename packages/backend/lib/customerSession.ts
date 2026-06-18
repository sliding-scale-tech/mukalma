import crypto from "node:crypto";

export type CustomerSessionPayload = {
	sessionId: string;
	tenantId: string;
	expiresAt: number;
};

function getSecret(): string {
	const secret = process.env.CUSTOMER_SESSION_SECRET;
	if (!secret) {
		throw new Error("CUSTOMER_SESSION_SECRET is not configured");
	}
	return secret;
}

export function signSession(payload: CustomerSessionPayload): string {
	const data = `${payload.sessionId}:${payload.tenantId}:${payload.expiresAt}`;
	return crypto.createHmac("sha256", getSecret()).update(data).digest("hex");
}

export function verifySession(
	token: string,
	payload: CustomerSessionPayload,
): boolean {
	const expected = signSession(payload);
	if (token.length !== expected.length) {
		return false;
	}
	return crypto.timingSafeEqual(
		Buffer.from(token, "hex"),
		Buffer.from(expected, "hex"),
	);
}
