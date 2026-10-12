import Link from "next/link";

export default function NotFound() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-semibold text-green-800">404</h1>
      <p className="text-gray-600 mt-2">The page you are looking for does not exist.</p>
      <Link href="/dashboard"
            className="inline-block mt-6 rounded-md bg-green-700 text-white px-4 py-2">
        Back to dashboard
      </Link>
    </div>
  );
}