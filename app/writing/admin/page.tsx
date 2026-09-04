import Link from "next/link";
import { signIn, signOut } from "../../../auth";
import { getWritingAccess } from "../../lib/writing-auth";

export default async function WritingAdminPage() {
  const access = await getWritingAccess();

  if (!access.allowed) {
    return (
      <div>
        <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Writing admin
        </h1>
        <p className="mt-4 text-[1rem] leading-7 text-[var(--ink-2)]">
          Sign in with the authorized GitHub account to manage writing.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/writing/admin" });
          }}
        >
          <button
            type="submit"
            className="cursor-pointer bg-[var(--cardinal)] px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-white"
          >
            Sign in with GitHub
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">
        Writing admin
      </h1>
      <p className="mt-4 text-[1rem] leading-7 text-[var(--ink-2)]">
        Signed in{access.session?.user?.name ? ` as ${access.session.user.name}` : ""}.
        Use Manage in the sidebar to rename, reorder, or delete posts.
      </p>
      <div className="mt-6 flex items-center gap-5">
        <Link href="/writing/new">New post</Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/writing" });
          }}
        >
          <button
            type="submit"
            className="cursor-pointer text-[var(--cardinal)] underline underline-offset-4"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
