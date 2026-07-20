import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button
        type="submit"
        aria-label="Sair"
        className="flex items-center text-faint transition-colors hover:text-ink"
      >
        <LogOut size={16} />
      </button>
    </form>
  );
}
