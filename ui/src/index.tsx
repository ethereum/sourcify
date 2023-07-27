import React from "react";
import ReactDOM from "react-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { AUTH0_DOMAIN, AUTH0_CLIENTID, AUTH0_AUDIENCE } from "./constants";

console.log(AUTH0_DOMAIN);

ReactDOM.render(
  <React.StrictMode>
    <Auth0Provider
      domain={AUTH0_DOMAIN.replace("https://", "")}
      clientId={AUTH0_CLIENTID}
      authorizationParams={{
        audience: AUTH0_AUDIENCE,
        scope: "openid profile",
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
