import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "@/App.tsx";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		{/* clay theme is a warm light-only palette — pin the color mode. */}
		<Provider forcedTheme="light">
			<App />
			<Toaster />
		</Provider>
	</StrictMode>
);
