import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Fetcher from "./pages/Fetcher";
import LandingPage from "./pages/LandingPage";
import Verifier from "./pages/Verifier";

function App() {
  return (
    <body className="flex min-h-screen text-gray-800 bg-gray-50">
      <BrowserRouter>
        <Routes>
          <Route path="/verifier" element={<Verifier />} />
          <Route path="/fetcher" element={<Fetcher />} />
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </body>
  );
}

export default App;
