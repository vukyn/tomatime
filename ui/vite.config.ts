import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
	base: "/",
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		minify: "esbuild",
		sourcemap: false,
		reportCompressedSize: true,
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			output: {
				// Group the large Chakra vendor chunk to avoid many tiny chunks.
				manualChunks(id) {
					const libraries = ["@chakra-ui"];
					if (libraries.some((lib) => id.includes(`node_modules/${lib}`))) {
						return id.toString().split("node_modules/")[1].split("/")[0].toString();
					}
				},
			},
		},
	},
});
