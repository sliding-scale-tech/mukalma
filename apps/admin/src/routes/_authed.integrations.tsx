import { api } from "@mukalma/backend/convex/_generated/api";
import { Badge } from "@mukalma/ui/components/badge";
import { Button } from "@mukalma/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mukalma/ui/components/card";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { useAction, useQuery } from "convex/react";
import {
	CheckCircle2,
	Copy,
	Loader2,
	MessageSquare,
	Plug,
	RefreshCw,
	Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export default function IntegrationsPage() {
	const current = useQuery(api.tenants.getCurrent);
	const isAdmin = current?.user.role === "org_admin";

	if (current === undefined || current === null) {
		return <Skeleton className="h-64 w-full" />;
	}

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-4xl space-y-8 p-6 md:p-8">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">
						Integrations
					</h1>
					<p className="text-muted-foreground">
						Connect channels and configure your widget.
					</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					<WhatsAppCard isAdmin={isAdmin} />
					{current.tenant && <WidgetSnippetCard slug={current.tenant.slug} />}
				</div>
			</div>
		</div>
	);
}

// Every WAHA status collapses into exactly one view, so the UI can never
// show contradictory controls (e.g. Connect and Disconnect together for a
// "failed" session, which the old per-button conditions allowed).
type ConnectionView =
	| "loading"
	| "disconnected"
	| "connecting"
	| "scan_qr"
	| "connected";

function toView(status: string): ConnectionView {
	if (status === "connected" || status === "working") return "connected";
	if (status === "scan_qr") return "scan_qr";
	if (status === "starting") return "connecting";
	// failed / stopped / disconnected / anything unknown → offer Connect
	return "disconnected";
}

function WhatsAppCard({ isAdmin }: { isAdmin: boolean }) {
	const startSession = useAction(api.integrationsActions.startWhatsAppSession);
	const getQR = useAction(api.integrationsActions.getWhatsAppQR);
	const stopSession = useAction(api.integrationsActions.stopWhatsAppSession);

	const [view, setView] = useState<ConnectionView>("loading");
	const [qr, setQr] = useState<string | null>(null);
	// Serializes operations: while one is in flight every button is disabled,
	// so connect/disconnect/refresh can never race each other.
	const [busy, setBusy] = useState<"connect" | "disconnect" | "refresh" | null>(
		null,
	);

	// Single round-trip state fetch: getWhatsAppQR returns both status and
	// (when applicable) the QR — no separate checkStatus call needed.
	const fetchState = useCallback(async (): Promise<ConnectionView> => {
		try {
			const result = await getQR();
			const next = toView(result.status);
			setQr(next === "scan_qr" ? result.qr : null);
			setView(next);
			return next;
		} catch {
			setQr(null);
			setView("disconnected");
			return "disconnected";
		}
	}, [getQR]);

	useEffect(() => {
		fetchState();
	}, [fetchState]);

	// While waiting for a scan: one combined poll per tick keeps the QR fresh
	// (WhatsApp QRs expire in ~20-60s) and detects the scan. Bounded so an
	// abandoned tab doesn't poll forever.
	useEffect(() => {
		if (view !== "scan_qr") return;
		const startedAt = Date.now();
		const id = setInterval(async () => {
			if (Date.now() - startedAt > 3 * 60_000) {
				clearInterval(id);
				setQr(null);
				setView("disconnected");
				toast.error("QR scan timed out. Click Connect to try again.");
				return;
			}
			const next = await fetchState();
			if (next !== "scan_qr") clearInterval(id);
		}, 4000);
		return () => clearInterval(id);
	}, [view, fetchState]);

	const handleRefresh = async () => {
		if (busy) return;
		setBusy("refresh");
		try {
			await fetchState();
		} finally {
			setBusy(null);
		}
	};

	const handleStart = async () => {
		if (busy) return;
		setBusy("connect");
		setView("connecting");
		setQr(null);
		try {
			await startSession();
			// Poll until WAHA reaches SCAN_QR_CODE or resumes WORKING.
			for (let attempt = 0; attempt < 20; attempt++) {
				await new Promise((r) => setTimeout(r, 1500));
				const next = await fetchState();
				if (next === "scan_qr" || next === "connected") return;
				// fetchState may briefly report "disconnected" while the session
				// is still starting — keep the connecting view during the poll.
				setView("connecting");
			}
			setView("disconnected");
			toast.error("Timed out waiting for QR code. Try again.");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to start session",
			);
			setView("disconnected");
		} finally {
			setBusy(null);
		}
	};

	const handleStop = async () => {
		if (busy) return;
		setBusy("disconnect");
		try {
			await stopSession();
			setQr(null);
			setView("disconnected");
			toast.success("WhatsApp disconnected");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to stop session",
			);
			// Unknown state after a failed stop — re-sync from the server.
			await fetchState();
		} finally {
			setBusy(null);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5 text-green-600" />
						<CardTitle>WhatsApp</CardTitle>
					</div>
					<StatusBadge status={view} />
				</div>
				<CardDescription>
					Connect your WhatsApp number to receive and reply to messages.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{(view === "loading" || view === "connecting") && (
					<div className="flex flex-col items-center justify-center gap-2 py-8">
						<Loader2 className="h-6 w-6 animate-spin" />
						{view === "connecting" && (
							<p className="text-muted-foreground text-sm">
								Starting session, waiting for QR…
							</p>
						)}
					</div>
				)}

				{view === "scan_qr" && qr && (
					<div className="flex flex-col items-center gap-3">
						<p className="text-sm">Scan this QR code with WhatsApp:</p>
						<div className="rounded-lg border bg-white p-4">
							<img
								src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`}
								alt="WhatsApp QR Code"
								className="h-[200px] w-[200px]"
							/>
						</div>
						<p className="text-muted-foreground text-xs">
							Waiting for scan... refreshing automatically.
						</p>
						{isAdmin && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleRefresh}
								disabled={busy !== null}
							>
								{busy === "refresh" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="mr-2 h-4 w-4" />
								)}
								Refresh QR Code
							</Button>
						)}
					</div>
				)}

				{view === "connected" && (
					<div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-800 text-sm dark:bg-green-950 dark:text-green-200">
						<CheckCircle2 className="h-4 w-4" />
						WhatsApp is connected and receiving messages.
					</div>
				)}

				{isAdmin && (
					<div className="flex gap-2">
						{/* Exactly one primary action per view — never both. */}
						{view === "disconnected" && (
							<Button onClick={handleStart} disabled={busy !== null}>
								{busy === "connect" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Plug className="mr-2 h-4 w-4" />
								)}
								Connect WhatsApp
							</Button>
						)}
						{(view === "connected" || view === "scan_qr") && (
							<Button
								variant="destructive"
								onClick={handleStop}
								disabled={busy !== null}
							>
								{busy === "disconnect" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Unplug className="mr-2 h-4 w-4" />
								)}
								Disconnect
							</Button>
						)}
						{view !== "scan_qr" && (
							<Button
								variant="outline"
								onClick={handleRefresh}
								disabled={busy !== null}
							>
								{busy === "refresh" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="mr-2 h-4 w-4" />
								)}
								Refresh Status
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function WidgetSnippetCard({ slug }: { slug: string }) {
	const widgetCdnUrl =
		(import.meta.env.VITE_WIDGET_CDN_URL as string | undefined) ||
		(typeof window !== "undefined" && window.location.hostname === "localhost"
			? window.location.origin.replace(":5173", ":5174")
			: "https://mukalma-web.vercel.app");

	const snippet = [
		"<script",
		`  src="${widgetCdnUrl}/loader.js"`,
		`  data-slug="${slug}"`,
		`  data-cdn-url="${widgetCdnUrl}"`,
		`  data-position="bottom-right"`,
		"  defer",
		"></script>",
	].join("\n");

	const handleCopy = () => {
		navigator.clipboard.writeText(snippet);
		toast.success("Copied to clipboard");
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Widget Embed</CardTitle>
				<CardDescription>
					Paste this snippet into your website's{" "}
					<code className="rounded bg-muted px-1">&lt;body&gt;</code> to show
					the chat widget.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="relative">
					<pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
						{snippet}
					</pre>
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-2 right-2"
						onClick={handleCopy}
					>
						<Copy className="h-4 w-4" />
					</Button>
				</div>
				<p className="text-muted-foreground text-xs">
					Widget is served from{" "}
					<code className="rounded bg-muted px-1">{widgetCdnUrl}</code>
				</p>
			</CardContent>
		</Card>
	);
}

function StatusBadge({ status }: { status: string }) {
	if (status === "connected") {
		return <Badge className="bg-green-600">Connected</Badge>;
	}
	if (status === "scan_qr") {
		return <Badge variant="secondary">Scan QR</Badge>;
	}
	if (status === "loading") {
		return <Badge variant="outline">Loading...</Badge>;
	}
	if (status === "connecting") {
		return <Badge variant="secondary">Connecting...</Badge>;
	}
	return <Badge variant="outline">Disconnected</Badge>;
}
