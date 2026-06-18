import { defineConfig } from "vite";

export default defineConfig({
	build: {
		lib: {
			entry: "src/loader.ts",
			name: "MukalmaWidgetLoader",
			fileName: () => "loader.js",
			formats: ["iife"],
		},
		outDir: "dist",
		emptyOutDir: true,
	},
});
