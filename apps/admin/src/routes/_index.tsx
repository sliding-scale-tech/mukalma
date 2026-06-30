import { useAuth } from "@clerk/react-router";
import {
	ArrowRight,
	Bot,
	Globe,
	MessageSquare,
	Shield,
	Users,
	Zap,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

export default function IndexPage() {
	const { isLoaded, isSignedIn } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (isLoaded && isSignedIn) {
			navigate("/dashboard", { replace: true });
		}
	}, [isLoaded, isSignedIn, navigate]);

	return (
		<div className="min-h-svh bg-background text-foreground">
			{/* Nav */}
			<header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-xs">
							M
						</div>
						<span className="font-semibold tracking-tight">Mukalma</span>
					</div>
					<nav className="flex items-center gap-2">
						<Link
							to="/login"
							className="rounded-md px-4 py-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							Log in
						</Link>
						<Link
							to="/signup"
							className="rounded-md bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
						>
							Get started
						</Link>
					</nav>
				</div>
			</header>

			{/* Hero */}
			<section className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
				<div className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-muted-foreground text-xs">
					<Zap className="h-3 w-3 text-primary" />
					AI-powered customer support
				</div>
				<h1 className="mb-5 text-balance font-bold text-5xl leading-tight tracking-tight lg:text-6xl">
					Support that works
					<br />
					<span className="text-primary">while you sleep</span>
				</h1>
				<p className="mx-auto mb-10 max-w-xl text-balance text-lg text-muted-foreground leading-relaxed">
					Mukalma handles customer questions instantly with AI trained on your
					own docs — and hands off to your team when a human touch is needed.
				</p>
				<div className="flex flex-wrap items-center justify-center gap-3">
					<Link
						to="/signup"
						className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:shadow-primary/30"
					>
						Start for free
						<ArrowRight className="h-4 w-4" />
					</Link>
					<Link
						to="/login"
						className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-semibold transition-colors hover:bg-accent"
					>
						Sign in to dashboard
					</Link>
				</div>
			</section>

			{/* Features */}
			<section className="border-t bg-muted/30">
				<div className="mx-auto max-w-6xl px-6 py-20">
					<h2 className="mb-12 text-center font-semibold text-2xl tracking-tight">
						Everything you need to support customers at scale
					</h2>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{[
							{
								icon: <Bot className="h-5 w-5" />,
								title: "AI that knows your business",
								desc: "Train the AI on your documentation, FAQs, and product info. It answers customer questions accurately — 24/7.",
							},
							{
								icon: <MessageSquare className="h-5 w-5" />,
								title: "WhatsApp & web widget",
								desc: "Meet customers where they are. One platform for your website chat widget and WhatsApp messages.",
							},
							{
								icon: <Users className="h-5 w-5" />,
								title: "Seamless agent handoff",
								desc: "When the AI can't help, it escalates to the right agent instantly. No customer left waiting.",
							},
							{
								icon: <Globe className="h-5 w-5" />,
								title: "One-line embed",
								desc: "Add the chat widget to any website with a single script tag. No complex setup required.",
							},
							{
								icon: <Zap className="h-5 w-5" />,
								title: "Real-time inbox",
								desc: "Manage all conversations in one place. See who's online, escalated threads, and unread counts at a glance.",
							},
							{
								icon: <Shield className="h-5 w-5" />,
								title: "Multi-tenant & secure",
								desc: "Full data isolation per organization. Invite your team with role-based access control.",
							},
						].map((f) => (
							<div
								key={f.title}
								className="rounded-xl border bg-background p-6 transition-shadow hover:shadow-md"
							>
								<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
									{f.icon}
								</div>
								<h3 className="mb-1.5 font-semibold">{f.title}</h3>
								<p className="text-muted-foreground text-sm leading-relaxed">
									{f.desc}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="mx-auto max-w-6xl px-6 py-20 text-center">
				<h2 className="mb-4 font-bold text-3xl tracking-tight">
					Ready to automate your support?
				</h2>
				<p className="mb-8 text-muted-foreground">
					Set up in minutes. No credit card required.
				</p>
				<Link
					to="/signup"
					className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90"
				>
					Get started free
					<ArrowRight className="h-4 w-4" />
				</Link>
			</section>

			{/* Footer */}
			<footer className="border-t">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
					<div className="flex items-center gap-2">
						<div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground text-xs">
							M
						</div>
						<span className="text-muted-foreground text-sm">Mukalma</span>
					</div>
					<p className="text-muted-foreground text-xs">
						© {new Date().getFullYear()} Mukalma. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	);
}
