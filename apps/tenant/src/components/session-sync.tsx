import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { setOnSessionExpired } from "@/lib/api-client";

export const SessionSync = () => {
  const navigate = useNavigate();

  useEffect(() => {
    setOnSessionExpired(() => {
      navigate("/", { replace: true });
    });
    return () => {
      setOnSessionExpired(undefined);
    };
  }, [navigate]);

  return null;
};
