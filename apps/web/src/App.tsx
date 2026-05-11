import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AppLayout } from "@/components/layout/app-layout"
import { queryClient } from "@/lib/query-client"
import { ProxiesPage } from "@/pages/proxies-page"
import { PreviewPage } from "@/pages/preview-page"
import { SystemPage } from "@/pages/system-page"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/proxies" replace />} />
            <Route path="/proxies" element={<ProxiesPage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/system" element={<SystemPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}

export default App
