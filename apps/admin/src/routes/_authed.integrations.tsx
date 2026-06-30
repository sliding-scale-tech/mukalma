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

function WhatsAppCard({ isAdmin }: { isAdmin: boolean }) {
	const startSession = useAction(api.integrationsActions.startWhatsAppSession);
	const getQR = useAction(api.integrationsActions.getWhatsAppQR);
	const checkStatus = useAction(api.integrationsActions.checkWhatsAppStatus);
	const stopSession = useAction(api.integrationsActions.stopWhatsAppSession);

	const [status, setStatus] = useState<string>("loading");
	const [qr, setQr] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const refreshStatus = useCallback(async () => {
		try {
			const result = await checkStatus();
			setStatus(result.status);
			if (result.status === "scan_qr") {
				const qrResult = await getQR();
				setQr(qrResult.qr);
				setStatus(qrResult.status);
			}
		} catch {
			setStatus("disconnected");
		}
	}, [checkStatus, getQR]);

	useEffect(() => {
		refreshStatus();
	}, [refreshStatus]);

	useEffect(() => {
		if (status !== "scan_qr") return;
		const id = setInterval(async () => {
			const result = await checkStatus();
			if (result.status === "connected") {
				setStatus("connected");
				setQr(null);
				clearInterval(id);
			}
		}, 5000);
		return () => clearInterval(id);
	}, [status, checkStatus]);

	const handleStart = async () => {
		setLoading(true);
		setStatus("connecting");
		try {
			await startSession();
			// Poll until WAHA reaches SCAN_QR_CODE (can take a few seconds)
			let attempts = 0;
			while (attempts < 15) {
				await new Promise((r) => setTimeout(r, 2000));
				const qrResult = await getQR();
				if (qrResult.qr) {
					setQr(qrResult.qr);
					setStatus("scan_qr");
					break;
				}
				if (qrResult.status === "connected") {
					setStatus("connected");
					break;
				}
				attempts++;
			}
			if (attempts >= 15) {
				toast.error("Timed out waiting for QR code. Try again.");
				setStatus("disconnected");
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to start session",
			);
			setStatus("disconnected");
		} finally {
			setLoading(false);
		}
	};

	const handleStop = async () => {
		setLoading(true);
		try {
			await stopSession();
			setStatus("disconnected");
			setQr(null);
			toast.success("WhatsApp disconnected");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to stop session",
			);
		} finally {
			setLoading(false);
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
					<StatusBadge status={status} />
				</div>
				<CardDescription>
					Connect your WhatsApp number to receive and reply to messages.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{(status === "loading" || status === "connecting") && (
					<div className="flex flex-col items-center justify-center gap-2 py-8">
						<Loader2 className="h-6 w-6 animate-spin" />
						{status === "connecting" && (
							<p className="text-muted-foreground text-sm">
								Starting session, waiting for QR…
							</p>
						)}
					</div>
				)}

				{status === "scan_qr" && qr && (
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
							Waiting for scan... checking every 5 seconds.
						</p>
					</div>
				)}

				{status === "connected" && (
					<div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-800 text-sm dark:bg-green-950 dark:text-green-200">
						<CheckCircle2 className="h-4 w-4" />
						WhatsApp is connected and receiving messages.
					</div>
				)}

				{isAdmin && (
					<div className="flex gap-2">
						{status !== "connected" &&
							status !== "scan_qr" &&
							status !== "connecting" && (
								<Button onClick={handleStart} disabled={loading}>
									{loading ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Plug className="mr-2 h-4 w-4" />
									)}
									Connect WhatsApp
								</Button>
							)}
						{status !== "disconnected" && status !== "loading" && (
							<Button
								variant="destructive"
								onClick={handleStop}
								disabled={loading}
							>
								{loading ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Unplug className="mr-2 h-4 w-4" />
								)}
								Disconnect
							</Button>
						)}
						<Button variant="outline" onClick={refreshStatus}>
							Refresh Status
						</Button>
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
	return <Badge variant="outline">Disconnected</Badge>;
}
