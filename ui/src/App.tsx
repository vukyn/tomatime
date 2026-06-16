import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PomodoroPage } from "@/features/pomodoro/PomodoroPage";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<PomodoroPage />} />
				{/* Single-page app for now; unknown deep links fall back to the timer. */}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
