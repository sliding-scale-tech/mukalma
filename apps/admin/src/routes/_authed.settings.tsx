import { api } from "@mukalma/backend/convex/_generated/api";
import { Button } from "@mukalma/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mukalma/ui/components/card";
import { Input } from "@mukalma/ui/components/input";
import { Label } from "@mukalma/ui/components/label";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { SettingsForm } from "@mukalma/ui/composites/onboarding-wizard";
import { useMutation, useQuery } from "convex/react";
import { Loader2, MessageSquare, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type WidgetMode = "light" | "dark" | "auto";

function LogoUploadCard({ currentLogoUrl }: { currentLogoUrl?: string }) {
	const generateUploadUrl = useMutation(api.tenants.generateLogoUploadUrl);
	const saveLogo = useMutation(api.tenants.saveLogoFromStorage);
	const removeLogo = useMutation(api.tenants.removeLogo);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [preview, setPreview] = useState<string | undefined>(currentLogoUrl);

	useEffect(() => {
		setPreview(currentLogoUrl);
	}, [currentLogoUrl]);

	const handleFile = async (file: File) => {
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			toast.error("Image must be under 2 MB");
			return;
		}
		setUploading(true);
		try {
			const uploadUrl = await generateUploadUrl();
			const res = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});
			if (!res.ok) throw new Error("Upload failed");
			const { storageId } = await res.json();
			const url = await saveLogo({ storageId });
			setPreview(url);
			toast.success("Logo saved");
		} catch {
			toast.error("Failed to upload logo");
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleRemove = async () => {
		try {
			await removeLogo();
			setPreview(undefined);
			toast.success("Logo removed");
		} catch {
			toast.error("Failed to remove logo");
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Logo</CardTitle>
				<CardDescription>
					Upload your business logo. Shown in the chat widget header.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-6">
					{/* Preview */}
					<div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
						{preview ? (
							<img
								src={preview}
								alt="Logo"
								className="h-full w-full object-contain p-1"
							/>
						) : (
							<span className="font-bold text-2xl text-muted-foreground">
								M
							</span>
						)}
					</div>

					{/* Actions */}
					<div className="flex flex-col gap-2">
						<input
							ref={fileInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp,image/svg+xml"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) handleFile(file);
							}}
						/>
						<Button
							variant="outline"
							size="sm"
							disabled={uploading}
							onClick={() => fileInputRef.current?.click()}
						>
							{uploading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Upload className="mr-2 h-4 w-4" />
							)}
							{uploading ? "Uploading…" : "Upload image"}
						</Button>
						{preview && (
							<Button
								variant="ghost"
								size="sm"
								className="text-destructive hover:text-destructive"
								onClick={handleRemove}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Remove logo
							</Button>
						)}
						<p className="text-muted-foreground text-xs">
							PNG, JPG, WebP or SVG · Max 2 MB
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function WidgetPreview({
	primaryColor,
	mode,
}: {
	primaryColor: string;
	mode: WidgetMode;
}) {
	const isDark = mode === "dark";
	const bg = isDark ? "#0f0f13" : "#ffffff";
	const surface = isDark ? "#1a1a24" : "#f5f5f7";
	const text = isDark ? "#e2e8f0" : "#0f0f13";
	const subtext = isDark ? "#94a3b8" : "#64748b";
	const border = isDark ? "#2d2d3d" : "#e5e7eb";
	const bubbleBg = `${primaryColor}22`;

	return (
		<div
			className="relative flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
			style={{ background: bg, borderColor: border, height: 380, width: 280 }}
		>
			{/* Header */}
			<div
				className="flex shrink-0 items-center gap-2.5 px-4 py-3"
				style={{ background: primaryColor }}
			>
				<div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-bold text-sm text-white">
					M
				</div>
				<div>
					<p className="font-semibold text-sm text-white">Support</p>
					<p className="text-white/70 text-xs">Online</p>
				</div>
				<X className="ml-auto h-4 w-4 text-white/70" />
			</div>

			{/* Messages */}
			<div className="flex flex-1 flex-col gap-2.5 overflow-hidden px-3 py-3">
				<div className="flex">
					<div
						className="max-w-[80%] rounded-lg rounded-tl-none px-3 py-2 text-xs leading-relaxed"
						style={{ background: bubbleBg, color: text }}
					>
						Hi! How can I help you today? 👋
					</div>
				</div>
				<div className="flex justify-end">
					<div
						className="max-w-[80%] rounded-lg rounded-tr-none px-3 py-2 text-white text-xs leading-relaxed"
						style={{ background: primaryColor }}
					>
						I need help with my order
					</div>
				</div>
				<div className="flex">
					<div
						className="max-w-[80%] rounded-lg rounded-tl-none px-3 py-2 text-xs leading-relaxed"
						style={{ background: bubbleBg, color: text }}
					>
						Sure! Please share your order number and I'll look into it.
					</div>
				</div>
			</div>

			{/* Input area */}
			<div
				className="shrink-0 border-t px-3 py-2.5"
				style={{ borderColor: border, background: surface }}
			>
				<div
					className="flex items-center gap-2 rounded-lg border px-3 py-2"
					style={{ borderColor: border, background: bg }}
				>
					<span className="flex-1 text-xs" style={{ color: subtext }}>
						Type a message…
					</span>
					<div
						className="flex h-6 w-6 items-center justify-center rounded-full"
						style={{ background: primaryColor }}
					>
						<MessageSquare className="h-3 w-3 text-white" />
					</div>
				</div>
			</div>
		</div>
	);
}

function WidgetAppearanceCard({
	initial,
	onSave,
}: {
	initial: { primaryColor?: string; mode?: WidgetMode };
	onSave: (values: {
		primaryColor?: string;
		mode?: WidgetMode;
	}) => Promise<void>;
}) {
	const [primaryColor, setPrimaryColor] = useState(
		initial.primaryColor ?? "#7c3aed",
	);
	const [mode, setMode] = useState<WidgetMode>(initial.mode ?? "auto");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setPrimaryColor(initial.primaryColor ?? "#7c3aed");
		setMode(initial.mode ?? "auto");
	}, [initial.primaryColor, initial.mode]);

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave({ primaryColor, mode });
		} finally {
			setSaving(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Widget Appearance</CardTitle>
				<CardDescription>
					Customize the look and feel of your chat widget. Changes are previewed
					live.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-8 lg:flex-row">
					{/* Controls */}
					<div className="flex-1 space-y-5">
						<div className="grid gap-2">
							<Label>Primary color</Label>
							<div className="flex items-center gap-3">
								<input
									type="color"
									value={primaryColor}
									onChange={(e) => setPrimaryColor(e.target.value)}
									className="h-9 w-14 cursor-pointer rounded-md border p-0.5"
								/>
								<Input
									value={primaryColor}
									onChange={(e) => setPrimaryColor(e.target.value)}
									className="w-32 font-mono text-sm uppercase"
									placeholder="#7c3aed"
									maxLength={7}
								/>
							</div>
						</div>

						<div className="grid gap-2">
							<Label>Theme mode</Label>
							<div className="flex gap-2">
								{(["light", "dark", "auto"] as const).map((m) => (
									<button
										key={m}
										type="button"
										onClick={() => setMode(m)}
										className={`rounded-lg border px-4 py-1.5 font-medium text-sm capitalize transition-all ${
											mode === m
												? "border-primary bg-primary text-primary-foreground shadow-sm"
												: "border-border hover:bg-accent"
										}`}
									>
										{m === "light"
											? "☀️ Light"
											: m === "dark"
												? "🌙 Dark"
												: "⚙️ Auto"}
									</button>
								))}
							</div>
							<p className="text-muted-foreground text-xs">
								Auto follows the visitor's system preference.
							</p>
						</div>

						<Button onClick={handleSave} disabled={saving} className="mt-2">
							{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save appearance
						</Button>
					</div>

					{/* Live preview */}
					<div className="shrink-0">
						<p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Live preview
						</p>
						<WidgetPreview
							primaryColor={primaryColor}
							mode={mode === "auto" ? "light" : mode}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default function SettingsPage() {
	const current = useQuery(api.tenants.getCurrent);
	const updateSettings = useMutation(api.tenants.updateSettings);
	const updateWidgetTheme = useMutation(api.tenants.updateWidgetTheme);

	if (current === undefined) {
		return (
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-2xl p-6 md:p-8">
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	if (!current?.tenant) {
		return (
			<div className="flex-1 overflow-y-auto">
				<div className="p-6 md:p-8">
					<p className="text-muted-foreground">Complete onboarding first.</p>
				</div>
			</div>
		);
	}

	const { tenant } = current;

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-5xl space-y-6 p-6 md:p-8">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
					<p className="text-muted-foreground">
						Manage your tenant configuration
					</p>
				</div>
				<LogoUploadCard currentLogoUrl={tenant.settings.logoUrl} />
				<SettingsForm
					initial={{
						name: tenant.name,
						logoUrl: tenant.settings.logoUrl,
						aiSystemPrompt: tenant.settings.aiSystemPrompt,
						escalationKeywords: tenant.settings.escalationKeywords,
						allowedDomains: tenant.settings.allowedDomains,
						widgetPosition: tenant.settings.widgetPosition,
						industry: tenant.settings.industry,
						timezone: tenant.settings.timezone,
					}}
					onSave={async (values) => {
						try {
							await updateSettings(values);
							toast.success("Settings saved");
						} catch (err) {
							toast.error(
								err instanceof Error ? err.message : "Failed to save settings",
							);
							throw err;
						}
					}}
				/>
				<WidgetAppearanceCard
					initial={tenant.settings.widgetTheme ?? {}}
					onSave={async (theme) => {
						try {
							await updateWidgetTheme(theme);
							toast.success("Appearance saved");
						} catch (err) {
							toast.error(
								err instanceof Error
									? err.message
									: "Failed to save appearance",
							);
						}
					}}
				/>
			</div>
		</div>
	);
}
