import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PublicRoute } from "./components/auth/PublicRoute";
import { ProtectedLayout } from "./components/layout/ProtectedLayout";
import { GlobalLoadingBar } from "./components/ui/GlobalLoadingBar";
import { LoadingState } from "./components/ui/LoadingState";
import { Toaster } from "@/components/ui/sonner";
const LandingPage = lazy(() => import("./routes/LandingPage"));
const LoginPage = lazy(() => import("./routes/LoginPage"));
const RegisterPage = lazy(() => import("./routes/RegisterPage"));
const PrivacyPolicyPage = lazy(() => import("./routes/PrivacyPolicyPage"));
const TermsOfUsePage = lazy(() => import("./routes/TermsOfUsePage"));
const PlacesPage = lazy(() => import("./routes/PlacesPage"));
const NewPlacePage = lazy(() => import("./routes/NewPlacePage"));
const EditPlacePage = lazy(() => import("./routes/EditPlacePage"));
const PlaceDetailPage = lazy(() => import("./routes/PlaceDetailPage"));
const NewVisitPage = lazy(() => import("./routes/NewVisitPage"));
const EditVisitPage = lazy(() => import("./routes/EditVisitPage"));
const AccountPage = lazy(() => import("./routes/AccountPage"));
const TrashPage = lazy(() => import("./routes/TrashPage"));
const NotFoundPage = lazy(() => import("./routes/NotFoundPage"));
const CollectionListPage = lazy(() => import("./routes/CollectionListPage"));
const CollectionDetailPage = lazy(() => import("./routes/CollectionDetailPage"));
const CollectionSharePage = lazy(() => import("./routes/CollectionSharePage"));
const VerifyEmailPage = lazy(() => import("./routes/VerifyEmailPage"));
const SharePage = lazy(() => import("./routes/SharePage"));

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <GlobalLoadingBar />
        <Toaster position="top-center" richColors />
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="min-h-screen p-4">
                <LoadingState />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                }
              />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/share/:token" element={<SharePage />} />
              <Route path="/share/collections/:token" element={<CollectionSharePage />} />
              <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
              <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
              <Route
                path="/places"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <PlacesPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <AccountPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/places/trash"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <TrashPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/places/new"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <NewPlacePage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/places/:id"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <PlaceDetailPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/places/:id/edit"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <EditPlacePage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/places/:id/visits/new"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <NewVisitPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/visits/:id/edit"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <EditVisitPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collections"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <CollectionListPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collections/:id"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <CollectionDetailPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  );
}
