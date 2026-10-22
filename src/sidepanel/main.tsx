import { render } from "preact";
import "@fontsource-variable/inter";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import { App } from "./App";

render(<App />, document.getElementById("root")!);
