import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/error-monitoring";

initErrorMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
