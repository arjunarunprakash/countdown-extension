import { render } from "preact";
import "@fontsource-variable/inter";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import { startClock } from "../state/clock";
import { addItem, initStore, items } from "../state/store";
import { App } from "./App";

await initStore();
startClock();

// Development builds only: open the panel with ?seed to load sample data into an empty list.
if (import.meta.env.MODE === "development" && new URLSearchParams(location.search).has("seed") && items.value.length === 0) {
  const { sampleItems } = await import("../lib/sample");
  sampleItems().forEach(addItem);
}

render(<App />, document.getElementById("root")!);
