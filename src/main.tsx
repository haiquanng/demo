import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./styles.css";

// Chuyển các link cũ dạng #campaign sang đường dẫn mới /campaign.
const OLD_HASH: Record<string, string> = { "#len-san": "/len-san", "#sync": "/sync-guard", "#campaign": "/campaign", "#koc": "/koc-claim", "#policy": "/policy-watch" };
if (OLD_HASH[location.hash]) history.replaceState(null, "", OLD_HASH[location.hash] + location.search);

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
