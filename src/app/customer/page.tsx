import { redirect } from "next/navigation";

/** Old URL — photographers now use `/studio`. */
export default function CustomerRedirectPage() {
  redirect("/studio");
}
