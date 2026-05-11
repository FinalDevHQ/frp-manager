import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AppLayout } from "@/components/layout/app-layout"
import { ProfileGuard } from "@/components/layout/profile-guard"
import { queryClient } from "@/lib/query-client"
import { ProxiesPage } from "@/pages/proxies-page"
import { PreviewPage } from "@/pages/preview-page"
import { SystemPage } from "@/pages/system-page"
import { SetupPage } from "@/pages/setup-page"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/proxies" replace />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route
              path="/proxies"
              element={
                <ProfileGuard>
                  <ProxiesPage />
                </ProfileGuard>
              }
            />
            <Route
              path="/preview"
              element={
                <ProfileGuard>
                  <PreviewPage />
                </ProfileGuard>
              }
            />
            <Route
              path="/system"
              element={
                <ProfileGuard>
                  <SystemPage />
                </ProfileGuard>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}

export default App
