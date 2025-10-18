import "./App.css";
import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout.tsx";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";

const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const DocsPage = lazy(() => import("./pages/DocsPage.tsx"));
const SpecExplorerPage = lazy(() => import("./pages/SpecExplorerPage.tsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.tsx"));

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="explorer" element={<SpecExplorerPage />} />
              <Route path="docs" element={<DocsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
