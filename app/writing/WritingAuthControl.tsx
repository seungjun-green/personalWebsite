import { auth, signIn, signOut } from "../../auth";

export default async function WritingAuthControl() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  if (signedIn) {
    return (
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/writing" });
        }}
      >
        <button
          type="submit"
          className="cursor-pointer border border-[var(--line-strong)] bg-white px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition-colors hover:border-[var(--cardinal)]"
        >
          Sign out
        </button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("github", { redirectTo: "/writing" });
      }}
    >
      <button
        type="submit"
        className="cursor-pointer border border-[var(--line-strong)] bg-white px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition-colors hover:border-[var(--cardinal)]"
      >
        Sign in
      </button>
    </form>
  );
}
