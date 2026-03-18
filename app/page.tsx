import Link from "next/link";
import Image from "next/image";
import Features from "@/components/Features";
import UseCases from "@/components/UseCases";
import HowItWorks from "@/components/HowItWorks";
import FloatingIn from "@/components/Floating";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <header className="py-6 px-4 md:px-6 flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">AgentForge</h1>

        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="px-4 py-2 border border-black rounded font-semibold hover:bg-black hover:text-white transition"
          >
            Open Editor
          </Link>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition"
              >
                Dashboard
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-100 transition text-slate-700"
                >
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition"
            >
              Sign In / Sign Up
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-6">
        <FloatingIn>
          <h2 className="text-4xl md:text-5xl font-extrabold">
            Visual AI Workflow Builder
          </h2>
        </FloatingIn>

        <FloatingIn delay={0.2}>
          <p className="max-w-xl text-gray-700">
            Build, connect, and simulate AI workflows in real time using a
            visual drag-and-drop interface.
          </p>
        </FloatingIn>

        <FloatingIn delay={0.4}>
          <Link
            href="/editor"
            className="px-6 py-3 border border-black rounded font-semibold hover:bg-black hover:text-white transition"
          >
            Launch Editor
          </Link>
        </FloatingIn>

        <div className="max-w-xl w-full mt-10">
          <Image
            src="/images/illustration.svg"
            alt="AI Workflow Illustration"
            width={600}
            height={400}
          />
        </div>
      </main>

      <Features />
      <HowItWorks />
      <UseCases />

      <footer className="py-6 text-center border-t border-black text-sm">
        <strong>AgentForge</strong> — Visual AI Agent Builder
      </footer>
    </div>
  );
}