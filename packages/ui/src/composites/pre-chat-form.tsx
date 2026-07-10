import { cn } from "@mukalma/ui/lib/utils";
import { Bot, X } from "lucide-react";
import { useEffect, useState } from "react";

export type PreChatFormTheme = {
	primaryColor?: string;
	mode?: "light" | "dark" | "auto";
};

type PreChatFormProps = {
	tenantName: string;
	logoUrl?: string | null;
	theme?: PreChatFormTheme;
	onSubmit: (details: { name: string; email: string }) => void;
	isEmbed?: boolean;
};

function useSystemDark() {
	const [dark, setDark] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => setDark(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return dark;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PreChatForm({
	tenantName,
	logoUrl,
	theme,
	onSubmit,
	isEmbed,
}: PreChatFormProps) {
	const systemDark = useSystemDark();
	const primary = theme?.primaryColor ?? "#7c3aed";
	const mode = theme?.mode ?? "auto";
	const isDark = mode === "dark" || (mode === "auto" && systemDark);

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);

	const vars = {
		"--wbg": isDark ? "#09090b" : "#ffffff",
		"--wtext": isDark ? "#fafafa" : "#09090b",
		"--wmuted": isDark ? "#a1a1aa" : "#6b7280",
		"--winput": isDark ? "#27272a" : "#ffffff",
		"--winput-border": isDark ? "#3f3f46" : "#d1d5db",
	} as React.CSSProperties;

	const handleClose = () => {
		window.parent.postMessage({ type: "mukalma:close" }, "*");
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = name.trim();
		const trimmedEmail = email.trim();
		if (!trimmedName) {
			setError("Please enter your name");
			return;
		}
		if (!EMAIL_RE.test(trimmedEmail)) {
			setError("Please enter a valid email address");
			return;
		}
		setError(null);
		onSubmit({ name: trimmedName, email: trimmedEmail });
	};

	return (
		<div
			className={cn(
				"flex min-h-0 flex-col",
				isEmbed ? "h-full" : "mx-auto h-dvh max-w-lg",
			)}
			style={{ background: "var(--wbg)", ...vars }}
		>
			{/* Header */}
			<div
				className="flex shrink-0 items-center gap-3 px-4 py-3"
				style={{ background: primary }}
			>
				<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20">
					{logoUrl ? (
						<img
							src={logoUrl}
							alt={tenantName}
							className="h-9 w-9 object-cover"
						/>
					) : (
						<Bot className="h-5 w-5 text-white" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-sm text-white">
						{tenantName}
					</p>
					<p className="truncate text-white/80 text-xs">
						Online and ready to help
					</p>
				</div>
				{isEmbed && (
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close chat"
						className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* Form */}
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
				<div
					className="mb-5 flex h-14 w-14 items-center justify-center rounded-full"
					style={{ background: `${primary}1a` }}
				>
					<Bot className="h-7 w-7" style={{ color: primary }} />
				</div>

				<h2
					className="text-center font-bold text-lg"
					style={{ color: "var(--wtext)" }}
				>
					Welcome to {tenantName}!
				</h2>
				<p
					className="mt-1 mb-6 text-center text-sm"
					style={{ color: "var(--wmuted)" }}
				>
					Please let us know your details to start chatting.
				</p>

				<form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
					<div className="space-y-1.5">
						<label
							htmlFor="prechat-name"
							className="font-medium text-sm"
							style={{ color: "var(--wtext)" }}
						>
							Name
						</label>
						<input
							id="prechat-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="John Doe"
							autoComplete="name"
							className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--wfocus)]"
							style={
								{
									background: "var(--winput)",
									borderColor: "var(--winput-border)",
									color: "var(--wtext)",
									"--wfocus": primary,
								} as React.CSSProperties
							}
						/>
					</div>

					<div className="space-y-1.5">
						<label
							htmlFor="prechat-email"
							className="font-medium text-sm"
							style={{ color: "var(--wtext)" }}
						>
							Email
						</label>
						<input
							id="prechat-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="john@example.com"
							autoComplete="email"
							className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--wfocus)]"
							style={
								{
									background: "var(--winput)",
									borderColor: "var(--winput-border)",
									color: "var(--wtext)",
									"--wfocus": primary,
								} as React.CSSProperties
							}
						/>
					</div>

					{error && (
						<p className="text-red-500 text-xs" role="alert">
							{error}
						</p>
					)}

					<button
						type="submit"
						className="w-full rounded-lg py-2.5 font-semibold text-sm text-white transition-opacity hover:opacity-90"
						style={{ background: primary }}
					>
						Start Chatting
					</button>
				</form>
			</div>
		</div>
	);
}
