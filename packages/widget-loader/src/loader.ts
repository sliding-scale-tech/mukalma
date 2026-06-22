(() => {
	const script = document.currentScript as HTMLScriptElement | null;
	if (!script) return;

	const slug = script.getAttribute("data-slug");
	if (!slug) {
		console.error("[Mukalma] data-slug attribute is required");
		return;
	}

	const position = script.getAttribute("data-position") || "bottom-right";
	const cdnUrl =
		script.getAttribute("data-cdn-url") || `https://${slug}.mukalma.co`;
	const isRight = position !== "bottom-left";
	const side = isRight ? "right" : "left";

	const ICON_CHAT = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
	const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

	// Launcher button
	const btn = document.createElement("button");
	btn.setAttribute("aria-label", "Open chat");
	btn.innerHTML = ICON_CHAT;
	Object.assign(btn.style, {
		position: "fixed",
		bottom: "24px",
		[side]: "24px",
		width: "60px",
		height: "60px",
		borderRadius: "50%",
		border: "none",
		background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
		color: "#fff",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		boxShadow: "0 4px 20px rgba(109,40,217,0.45)",
		zIndex: "99999",
		transition: "transform 0.2s ease, box-shadow 0.2s ease",
	});

	btn.addEventListener("mouseenter", () => {
		btn.style.transform = "scale(1.08)";
		btn.style.boxShadow = "0 6px 28px rgba(109,40,217,0.6)";
	});
	btn.addEventListener("mouseleave", () => {
		btn.style.transform = "scale(1)";
		btn.style.boxShadow = "0 4px 20px rgba(109,40,217,0.45)";
	});

	// Chat panel container
	const container = document.createElement("div");
	Object.assign(container.style, {
		position: "fixed",
		bottom: "96px",
		[side]: "24px",
		width: "400px",
		height: "600px",
		maxHeight: "calc(100dvh - 116px)",
		borderRadius: "20px",
		overflow: "hidden",
		boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
		zIndex: "99998",
		display: "none",
		opacity: "0",
		transform: "translateY(12px) scale(0.97)",
		transition: "opacity 0.22s ease, transform 0.22s ease",
	});

	// Responsive: shrink on narrow viewports
	function applyContainerSize() {
		const vw = window.innerWidth;
		if (vw < 480) {
			Object.assign(container.style, {
				width: `${vw - 32}px`,
				[side]: "16px",
			});
		} else {
			Object.assign(container.style, {
				width: "400px",
				[side]: "24px",
			});
		}
	}
	window.addEventListener("resize", applyContainerSize);
	applyContainerSize();

	const iframe = document.createElement("iframe");
	iframe.src = `${cdnUrl}/embed?slug=${encodeURIComponent(slug)}`;
	Object.assign(iframe.style, {
		width: "100%",
		height: "100%",
		border: "none",
		display: "block",
	});
	iframe.setAttribute("allow", "clipboard-write");
	container.appendChild(iframe);

	document.body.appendChild(container);
	document.body.appendChild(btn);

	let isOpen = false;
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	function open() {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
		isOpen = true;
		btn.innerHTML = ICON_CLOSE;
		btn.setAttribute("aria-label", "Close chat");
		container.style.display = "block";
		// Trigger transition on next frame
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				container.style.opacity = "1";
				container.style.transform = "translateY(0) scale(1)";
			});
		});
	}

	function close() {
		isOpen = false;
		btn.innerHTML = ICON_CHAT;
		btn.setAttribute("aria-label", "Open chat");
		container.style.opacity = "0";
		container.style.transform = "translateY(12px) scale(0.97)";
		closeTimer = setTimeout(() => {
			container.style.display = "none";
			closeTimer = null;
		}, 220);
	}

	btn.addEventListener("click", () => {
		isOpen ? close() : open();
	});

	window.addEventListener("message", (event) => {
		if (event.data?.type === "mukalma:close") close();
	});
})();
