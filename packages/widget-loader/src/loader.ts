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

	const isRight = position === "bottom-right";

	// Toggle button
	const btn = document.createElement("button");
	btn.setAttribute("aria-label", "Open chat");
	btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
	Object.assign(btn.style, {
		position: "fixed",
		bottom: "20px",
		[isRight ? "right" : "left"]: "20px",
		width: "56px",
		height: "56px",
		borderRadius: "50%",
		border: "none",
		backgroundColor: "#18181b",
		color: "#fff",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
		zIndex: "99999",
		transition: "transform 0.2s ease",
	});
	btn.addEventListener("mouseenter", () => {
		btn.style.transform = "scale(1.05)";
	});
	btn.addEventListener("mouseleave", () => {
		btn.style.transform = "scale(1)";
	});

	// Chat container
	const container = document.createElement("div");
	Object.assign(container.style, {
		position: "fixed",
		bottom: "88px",
		[isRight ? "right" : "left"]: "20px",
		width: "400px",
		height: "600px",
		maxHeight: "calc(100vh - 108px)",
		borderRadius: "16px",
		overflow: "hidden",
		boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
		border: "1px solid #e4e4e7",
		zIndex: "99998",
		display: "none",
	});

	const iframe = document.createElement("iframe");
	iframe.src = `${cdnUrl}/embed?slug=${encodeURIComponent(slug)}`;
	Object.assign(iframe.style, {
		width: "100%",
		height: "100%",
		border: "none",
	});
	iframe.setAttribute("allow", "clipboard-write");
	container.appendChild(iframe);

	document.body.appendChild(btn);
	document.body.appendChild(container);

	let isOpen = false;
	btn.addEventListener("click", () => {
		isOpen = !isOpen;
		container.style.display = isOpen ? "block" : "none";
	});

	window.addEventListener("message", (event) => {
		if (event.data?.type === "mukalma:close") {
			isOpen = false;
			container.style.display = "none";
		}
	});
})();
