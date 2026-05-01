import Link from 'next/link';
import { getDefaultCoordinator } from '@/lib/db';

export default async function Home() {
  const coord = await getDefaultCoordinator();
  const memberHref = coord ? `/member?coord=${coord.id}` : '/member';

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

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href={memberHref}
            className="bg-orange-500 hover:bg-orange-600 text-white text-center py-4 px-8 rounded-2xl text-lg font-semibold shadow-md transition-all active:scale-95"
          >
            I&apos;m a Member
          </Link>
          <div className="pt-4 text-center">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Admin Portal →
            </Link>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-gray-400 pb-8">
        Built for Seva Commons
      </footer>
    </main>
  );
}
