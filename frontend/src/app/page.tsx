import { redirect } from "next/navigation";

/**
 * Root page — authenticated users land here after login.
 * Redirect to /dashboard so the URL is meaningful.
 */
export default function HomePage() {
  redirect("/dashboard");
}
