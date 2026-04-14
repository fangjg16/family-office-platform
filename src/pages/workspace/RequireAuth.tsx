import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { loadSessionUserId } from "@/workspace/session";

export default function RequireAuth() {
  const navigate = useNavigate();
  const userId = loadSessionUserId();

  useEffect(() => {
    if (!userId) {
      navigate("/app/login", { replace: true });
    }
  }, [userId, navigate]);

  if (!userId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        跳转登录…
      </div>
    );
  }

  return <Outlet />;
}
