import { render } from "preact";
import { completeSignInFromUrl } from "./google/auth";
import { init } from "./data/store";
import { App } from "./ui/App";
import "./styles.css";

// Must run before anything reads the URL: a return from Google sign-in puts the token in the hash.
const signIn = completeSignInFromUrl();
init(signIn.error);

render(<App />, document.getElementById("app")!);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => { /* app still works, just not offline */ });
}
