import { redirect } from "next/navigation";
import Portal from "./view";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.PORTAL_MODE === "admin") redirect("/admin");
  return <Portal />;
}
