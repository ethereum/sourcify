import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Lookup from "./pages/Lookup";
import Verifier from "./pages/Verifier";

function App() {
  return (
    <body className="flex min-h-screen text-gray-800 bg-gray-50">
      <BrowserRouter>
        <Routes>
          <Route path="/verifier" element={<Verifier />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </body>
  );
}

export default App;
