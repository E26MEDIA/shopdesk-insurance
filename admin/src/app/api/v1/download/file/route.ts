import { redirect } from "next/navigation";

/** Never send the browser to Dropbox — the public page downloads the file in place. */
export async function GET() {
  redirect("/download");
}
