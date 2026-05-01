import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-orange-500 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg">
            🫶
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Seva Track</h1>
          <p className="text-gray-500">Seva Commons · Meal Bag Delivery</p>
        </div>

        <div className="pt-4 text-center">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Admin Portal →
          </Link>
        </div>
      </div>

      <footer className="text-center text-xs text-gray-400 pb-8">
        Built for Seva Commons
      </footer>
    </main>
  );
}
