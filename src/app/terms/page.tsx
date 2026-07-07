import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="text-orange-500 text-base font-medium">← Home</Link>
        <h1 className="font-bold text-gray-800 text-lg">Terms and Privacy Policy</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 text-gray-700">

        <div>
          <p className="text-sm text-gray-400">Last updated: July 7, 2026</p>
          <p className="text-sm text-gray-400 mt-1">Seva Track is operated by Seva Commons, a volunteer organization.</p>
        </div>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. What This App Does</h2>
          <p className="text-base leading-relaxed">
            Seva Track is a volunteer coordination tool for Seva Commons. It allows volunteers to sign up for meal bag delivery dates, mark deliveries as complete, and allows coordinators to manage the delivery schedule. This app is not a commercial service and is not intended for the general public.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. Information We Collect</h2>
          <p className="text-base leading-relaxed mb-3">When you use this app as a volunteer, we collect:</p>
          <ul className="list-disc list-inside space-y-2 text-base">
            <li><span className="font-medium">Your name</span> — used to identify your signup and notify your coordinator</li>
            <li><span className="font-medium">Your phone number</span> — used to look up your deliveries, send verification codes, and send delivery reminders via SMS or WhatsApp</li>
            <li><span className="font-medium">Delivery photos</span> — uploaded by you when marking a delivery complete, stored and visible to your coordinator</li>
          </ul>
          <p className="text-base leading-relaxed mt-3">
            We do not collect your email address, location, device information, or any financial information. We do not create user accounts for volunteers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <p className="text-base leading-relaxed mb-2">Your information is used exclusively for:</p>
          <ul className="list-disc list-inside space-y-2 text-base">
            <li>Displaying your signup to your coordinator in their dashboard</li>
            <li>Sending you a one-time verification code when you sign up or cancel</li>
            <li>Sending you delivery reminders via text message before your scheduled delivery date</li>
            <li>Allowing you to look up your pending deliveries by phone number</li>
          </ul>
          <p className="text-base leading-relaxed mt-3">
            We do not use your information for marketing, advertising, or any purpose unrelated to volunteer coordination.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. Information Visible to Others</h2>
          <p className="text-base leading-relaxed mb-2">The following information is visible within the app:</p>
          <ul className="list-disc list-inside space-y-2 text-base">
            <li>Your name and what you are bringing are shown to other volunteers on the signup page</li>
            <li>Your coordinator can see your name, phone number, signup details, and delivery photo</li>
            <li>Your phone number is never shown to other volunteers</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">5. Third-Party Services</h2>
          <p className="text-base leading-relaxed mb-3">
            This app uses the following third-party services, each with their own privacy policies:
          </p>
          <ul className="list-disc list-inside space-y-2 text-base">
            <li><span className="font-medium">Supabase</span> — stores your name, phone number, signup records, and delivery photos in a PostgreSQL database hosted in the United States</li>
            <li><span className="font-medium">Twilio</span> — sends SMS and WhatsApp messages to your phone number for verification codes and delivery reminders</li>
            <li><span className="font-medium">Vercel</span> — hosts the application and processes web requests</li>
          </ul>
          <p className="text-base leading-relaxed mt-3">
            Your data is not sold to, shared with, or licensed to any other third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">6. Data Retention</h2>
          <p className="text-base leading-relaxed">
            Your signup records are retained for as long as necessary to track volunteer contributions and coordinate deliveries. Your coordinator may delete your signup or member record at any time. Delivery photos are retained in storage until deleted by the coordinator. Phone verification codes are automatically expired after 10 minutes and deleted within 24 hours.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">7. SMS and WhatsApp Messaging</h2>
          <p className="text-base leading-relaxed">
            By providing your phone number, you consent to receiving text messages from Seva Track for the purposes of identity verification and delivery reminders. Message and data rates may apply depending on your carrier plan. You may contact your coordinator to be removed from the messaging list at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">8. Your Rights</h2>
          <p className="text-base leading-relaxed mb-2">You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-base">
            <li>Ask your coordinator to delete your name, phone number, and signup history at any time</li>
            <li>Cancel any pending signup using the Cancel button in the app</li>
            <li>Ask what information is stored about you by contacting your coordinator</li>
          </ul>
          <p className="text-base leading-relaxed mt-3">
            If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to request deletion, and the right to non-discrimination for exercising your rights. To exercise these rights, contact your coordinator or reach out using the information below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">9. Security</h2>
          <p className="text-base leading-relaxed">
            This app uses industry-standard security practices including HTTPS encryption for all data in transit, database-level Row Level Security policies that restrict access to your data, bcrypt-hashed passwords for coordinator accounts, and server-side verification for all sensitive actions. No security system is perfect, but we take reasonable measures to protect your information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">10. No Warranty</h2>
          <p className="text-base leading-relaxed">
            This app is provided as-is for volunteer coordination purposes. Seva Commons makes no warranties, express or implied, about the reliability, availability, or fitness of this app for any particular purpose. We are not liable for any loss of data, missed deliveries, or other damages arising from use of this app.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">11. Changes to This Policy</h2>
          <p className="text-base leading-relaxed">
            We may update this policy from time to time. Continued use of the app after changes are posted constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">12. Contact</h2>
          <p className="text-base leading-relaxed">
            For any questions about these terms or your data, contact your Seva Commons coordinator directly via WhatsApp or phone, or email the app administrator at ahujacorp@gmail.com.
          </p>
        </section>

        <div className="border-t border-gray-200 pt-6">
          <Link href="/" className="text-orange-500 font-medium text-base">← Back to Home</Link>
        </div>
      </div>
    </main>
  );
}
