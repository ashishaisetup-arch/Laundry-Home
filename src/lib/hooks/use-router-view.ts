import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

export function useRouterView(defaultView = "dashboard"): [string, React.Dispatch<React.SetStateAction<string>>, (view: string) => void] {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState(defaultView);

  // On mount, read the view from the URL path (last segment)
  useEffect(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const viewFromUrl = segments.length >= 2 ? segments[segments.length - 1] : null;
    if (viewFromUrl && viewFromUrl !== role) {
      setView(viewFromUrl);
    }
  }, []);

  const handleNavigate = useCallback((v: string) => {
    setView(v);
    if (role) {
      navigate(`/${role}/${v}`, { replace: v === defaultView });
    }
  }, [role, navigate, defaultView]);

  return [view, setView, handleNavigate];
}
