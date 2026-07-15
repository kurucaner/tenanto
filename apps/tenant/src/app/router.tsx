import { createBrowserRouter } from "react-router-dom";

import { RootLayout } from "@/app/root-layout";
import { HomePage } from "@/pages/home-page";

export const router = createBrowserRouter([
  {
    children: [{ element: <HomePage />, index: true }],
    element: <RootLayout />,
    path: "/",
  },
]);
