import { RouterProvider } from "react-router-dom";

import { router } from "@/app/router";
import { GoogleOAuthProvider } from "@/components/auth/google-oauth-provider";

export const App = () => (
  <GoogleOAuthProvider>
    <RouterProvider router={router} />
  </GoogleOAuthProvider>
);
