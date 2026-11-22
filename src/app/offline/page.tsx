import Link from "next/link";

export default function Offline() {
  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-16 text-center">
      <div className="text-5xl">📶</div>
      <h1 className="mt-4 text-2xl font-extrabold">नेटवर्क नाही · You are offline</h1>
      <p className="mt-2 text-muted">
        Scanning still works. Open the capture screen — photos are saved on this phone and upload when the signal returns.
      </p>
      <Link href="/capture" className="mt-6 inline-block rounded-2xl bg-forest-700 px-6 py-4 font-bold text-white">
        स्कॅन करा · Scan
      </Link>
    </main>
  );
}
