import { createInstance, MatomoProvider } from "@datapunt/matomo-tracker-react";
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ContextProvider } from "./Context";
import LandingPage from "./pages/LandingPage";
import Lookup from "./pages/Lookup";
import Verifier from "./pages/Verifier";

const instance = createInstance({
  urlBase: "https://matomo.ethereum.org/",
  siteId: 30,
});

function App() {
  return (
    <div className="flex min-h-screen text-gray-800 bg-gray-50">
      <MatomoProvider value={instance}>
        <ContextProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/verifier" element={<Verifier />} />
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/" element={<LandingPage />} />
            </Routes>
          </BrowserRouter>
        </ContextProvider>
      </MatomoProvider>
    </div>
  );
}

export default App;
