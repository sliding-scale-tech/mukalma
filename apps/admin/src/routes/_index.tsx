import { useAuth } from "@clerk/react-router";
import { Navigate } from "react-router";

export default function IndexPage() {
	const { isLoaded, isSignedIn } = useAuth();
	if (!isLoaded) return null;
	return <Navigate to={isSignedIn ? "/dashboard" : "/login"} replace />;
}
