'use client';

import { useState } from 'react';
import Link from 'next/link';

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className={`px-4 py-3 ${color}`}>
        <p className="font-bold text-base">{title}</p>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">{n}</div>
      <div className="flex-1">
        <p className="font-semibold text-gray-800 text-base">{icon} {title}</p>
        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Tip({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

function QA({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-800 text-sm">{q}</p>
        <span className={`text-orange-400 text-lg transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{a}</p>}
    </div>
  );
}

function VolunteerGuide() {
  return (
    <div className="space-y-4 mt-2">

      <div className="bg-orange-500 rounded-2xl p-4 text-white">
        <p className="font-bold text-lg mb-1">Welcome, Volunteer! 🫶</p>
        <p className="text-orange-100 text-sm leading-relaxed">
          Thank you for being part of Seva Commons. This guide walks you through everything — from signing up to making and dropping off meal bags.
        </p>
      </div>

      <Section title="What You're Making" color="bg-orange-100 text-orange-800">
        <p className="text-sm text-gray-600 leading-relaxed">
          Each month, volunteers make and drop off <strong>20 meal bags</strong>. Each bag contains 5 items and goes directly to people experiencing homelessness.
        </p>
        <div className="grid grid-cols-5 gap-2 pt-1">
          {[
            { icon: '🥪', label: 'PB&J Sandwich' },
            { icon: '🍊', label: 'Fresh Fruit' },
            { icon: '🍟', label: 'Snack Packet' },
            { icon: '🍫', label: 'Granola Bar' },
            { icon: '🧃', label: 'Juice Drink' },
          ].map(({ icon, label }) => (
            <div key={label} className="text-center">
              <div className="bg-orange-50 rounded-xl py-2 mb-1 text-2xl">{icon}</div>
              <p className="text-xs text-gray-600 leading-tight font-medium">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Step-by-Step: How It Works" color="bg-green-100 text-green-800">
        <Step n={1} icon="📱" title="Open the app"
          body="Go to the member page (seva-track.vercel.app/member). You can bookmark this or use the link your coordinator sends you." />
        <Step n={2} icon="📅" title="Find an upcoming date"
          body="Upcoming delivery dates are listed on the Sign Up tab. Each card shows the drop-off time, location, and how many spots are left." />
        <Step n={3} icon="✍️" title="Sign up"
          body="Tap 'Sign Up' on the date you want. Enter your full name and phone number, choose whether you're bringing Meal Bags, Nutritional Items, or both, then tap Confirm." />
        <Step n={4} icon="📅" title="Add to your calendar"
          body="After signing up, tap 'Add to Google Calendar' to set a reminder. This saves the drop-off time and address so you don't forget." />
        <Step n={5} icon="🛒" title="Shop for ingredients"
          body="Use the shopping list below. Most items are from Costco. Shop 1–2 days before the drop-off date." />
        <Step n={6} icon="🥪" title="Make the bags"
          body="Make 20 PB&J sandwiches, pack 1 sandwich + 1 fruit + 1 snack + 1 granola bar + 1 juice drink into each brown bag. Wear gloves and a mask while packing. Label each bag with a Seva or Chirag SJC sticker." />
        <Step n={7} icon="📦" title="Drop off"
          body="Bring all 20 bags to the address shown on your event card (usually your coordinator's home) within the drop-off window shown — typically 6:00 PM–9:00 PM the evening before delivery day." />
        <Step n={8} icon="✅" title="Mark as delivered"
          body="Open the app → Mark Delivered tab → enter your phone number → tap Find → tap 'Deliver →' next to your signup → take a photo and confirm. This tells your coordinator you're done." />
      </Section>

      <Section title="Shopping List (for 20 bags)" color="bg-blue-100 text-blue-800">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Most items from Costco</p>
        {[
          { item: 'Skippy Peanut Butter', qty: '1 bottle' },
          { item: 'Kirkland Organic Strawberry Spread', qty: '½ bottle' },
          { item: 'Oroweat 100% Whole Wheat Bread', qty: '3 packs (Costco 2-pack)' },
          { item: 'Sandwich Ziplock Bags', qty: '20' },
          { item: 'Cuties (clementines)', qty: '1 bag' },
          { item: 'Nature Valley Crunchy Granola Bar', qty: '20' },
          { item: 'Frito Lay Fun Flavor Mix', qty: '20' },
          { item: 'Honest Kids Organic Juice Drink', qty: '20' },
          { item: 'Brown paper bags', qty: '20' },
          { item: 'Labels, scissors, stapler', qty: 'for packing' },
        ].map((row, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
            <div className="flex-1 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">{row.item}</p>
              <p className="text-xs text-gray-400 flex-shrink-0">{row.qty}</p>
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
          You can swap chips, bars, or drinks for any equivalent item.
        </p>
      </Section>

      <Section title="Cancelling a Signup" color="bg-red-100 text-red-800">
        <p className="text-sm text-gray-600 leading-relaxed">
          Life happens. If you can't make it, please cancel as early as possible so another volunteer can take your spot.
        </p>
        <div className="bg-red-50 rounded-xl p-3 space-y-2">
          <Tip icon="1️⃣" text="Go to the Mark Delivered tab on the member page." />
          <Tip icon="2️⃣" text="Enter the phone number you signed up with and tap Find." />
          <Tip icon="3️⃣" text="Tap 'Cancel my signup' under your pending delivery." />
          <Tip icon="4️⃣" text="Your coordinator will automatically be notified via WhatsApp." />
        </div>
        <p className="text-xs text-orange-600 font-medium">Please cancel at least 2 days before drop-off if possible.</p>
      </Section>

      <Section title="Tips for Packing" color="bg-amber-100 text-amber-800">
        <Tip icon="🧤" text="Always wear disposable gloves and a mask when making and packing sandwiches." />
        <Tip icon="🏷" text="Label every bag before drop-off. Use the Seva or Chirag SJC stickers your coordinator provides." />
        <Tip icon="🕕" text="Drop off on time — the coordinator needs to pack everything for delivery the next morning." />
        <Tip icon="📸" text="Take a photo when you drop off. You'll need it to mark your delivery as done in the app." />
        <Tip icon="🔄" text="You can sign up for as many months as you like. The more the merrier!" />
      </Section>

      <Section title="Frequently Asked Questions" color="bg-gray-100 text-gray-700">
        <div className="space-y-3">
          <QA q="What if I don't see any upcoming dates?" a="Signups open at the beginning of each month for that month's dates. If the page says 'No upcoming dates yet', check back after the 1st of the month, or contact your coordinator." />
          <QA q="Can I sign up for Meal Bags AND Nutritional Items?" a="Yes! When signing up, check both boxes. You'll be listed as bringing both." />
          <QA q="What if the slot is full?" a="It will show 'Full' and the sign-up button will be disabled. Message your coordinator on WhatsApp — they can add you manually if capacity allows." />
          <QA q="I forgot to mark as delivered. What do I do?" a="You can still mark it late — just go to the Mark Delivered tab, look up your phone number, and submit. If it's been more than a day, message your coordinator and they can mark it for you." />
          <QA q="I entered my phone wrong when I signed up. How do I find my signup?" a="Enter whatever number you typed when you signed up. If you can't find it, contact your coordinator — they can look you up by name and fix it." />
          <QA q="Is the app only for iPhone?" a="No — it works on any smartphone or computer browser. There's nothing to download." />
        </div>
      </Section>

      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
        <p className="text-2xl mb-1">🙏</p>
        <p className="font-semibold text-green-800 text-base">Thank you for your seva!</p>
        <p className="text-sm text-green-600 mt-1">Every bag you make and deliver makes a real difference.</p>
      </div>

    </div>
  );
}

function CoordinatorGuide() {
  return (
    <div className="space-y-4 mt-2">

      <div className="bg-gray-800 rounded-2xl p-4 text-white">
        <p className="font-bold text-lg mb-1">Coordinator Guide 🗂</p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Everything you need to manage your Seva Commons delivery operation — from creating dates to confirming deliveries.
        </p>
      </div>

      <Section title="Logging In" color="bg-orange-100 text-orange-800">
        <Step n={1} icon="🌐" title="Go to the Admin Portal"
          body="Open seva-track.vercel.app and tap 'Admin Portal →' at the bottom of the home screen." />
        <Step n={2} icon="📧" title="Enter your credentials"
          body="Sign in with your email and password. These were set when your account was created. If you forgot your password, use the 'Forgot password?' link." />
        <Step n={3} icon="✅" title="You're in"
          body="You'll land on your dashboard showing upcoming dates, signup counts, and delivery stats." />
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-sm text-amber-800 font-medium">⚠️ New accounts need approval from Ishaan or Anupama before you can log in for the first time.</p>
        </div>
      </Section>

      <Section title="Dashboard Overview" color="bg-blue-100 text-blue-800">
        <p className="text-sm text-gray-600 leading-relaxed">The dashboard has 5 tabs:</p>
        <div className="space-y-2">
          {[
            { tab: 'Dates', desc: 'View, edit, and manage all your delivery dates. Click any date to see signups.' },
            { tab: '+ Add', desc: 'Create new delivery dates — single or recurring monthly.' },
            { tab: 'Members', desc: 'See all volunteers, their delivery history, and total contribution counts.' },
            { tab: 'Settings', desc: 'Update your name, phone, default drop-off address, and signup window.' },
            { tab: 'Logistics', desc: 'The volunteer-facing packing guide and shopping list.' },
          ].map(({ tab, desc }) => (
            <div key={tab} className="flex items-start gap-2.5">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">{tab}</span>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500">The stats bar at the top shows total upcoming dates, signups, deliveries, pending, meal bags, and nutritional items at a glance.</p>
      </Section>

      <Section title="Creating Delivery Dates" color="bg-green-100 text-green-800">
        <Step n={1} icon="➕" title="Go to the '+ Add' tab"
          body="Tap the '+ Add' tab in the dashboard navigation." />
        <Step n={2} icon="📅" title="Enter dates"
          body="Up to 4 dates at a time. You can also add a note for volunteers (e.g. 'Please bring extra bags')." />
        <Step n={3} icon="🔢" title="Set slots"
          body="Choose how many Meal Bag slots and Nutritional Item slots to offer. Volunteers can only sign up if a slot is available." />
        <Step n={4} icon="⏰" title="Set drop-off window"
          body="Enter the start and end time for drop-off (e.g. 6:00 PM – 9:00 PM). This shows up on each volunteer's signup confirmation." />
        <Step n={5} icon="📍" title="Set drop-off location"
          body="Defaults to your address from Settings. You can override it per date (see 'Different Address for Specific Weeks' below)." />
        <Step n={6} icon="🔄" title="Repeat monthly (optional)"
          body="Check 'Repeat monthly' to auto-generate dates for the same weekday pattern (e.g. 3rd Saturday) across multiple months." />
        <Step n={7} icon="✅" title="Tap 'Create Dates'"
          body="Dates are created and volunteers on your contact list are automatically notified via WhatsApp that signups are open." />
      </Section>

      <Section title="Sharing the Signup Link" color="bg-purple-100 text-purple-800">
        <p className="text-sm text-gray-600 leading-relaxed">
          Every coordinator has a unique signup link that goes directly to your dates. Share it with your volunteers so they can sign up.
        </p>
        <div className="bg-purple-50 rounded-xl p-3 space-y-2">
          <Tip icon="📋" text="Tap 'Copy' next to the link to copy it to your clipboard, then paste it anywhere." />
          <Tip icon="💬" text="Tap 'Share via WhatsApp' to open WhatsApp with the link pre-filled in a message. Just pick your group or individual contacts and send." />
        </div>
        <p className="text-xs text-gray-400">Your link looks like: seva-track.vercel.app/member?coord=YOURCODE</p>
      </Section>

      <Section title="Managing Signups" color="bg-orange-100 text-orange-800">
        <p className="text-sm text-gray-600 leading-relaxed">Tap any date on the Dates tab to open the event detail view.</p>
        <div className="space-y-3 mt-1">
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-orange-800 mb-1">Viewing signups</p>
            <p className="text-sm text-gray-600">All signed-up volunteers are listed with their name, item type, and status (Pending / Delivered / Confirmed).</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-green-800 mb-1">Adding a volunteer manually</p>
            <p className="text-sm text-gray-600">Tap '+ Add Member', enter their name, phone number (optional), and item type, then tap 'Add to List'. They'll appear as 'Added by admin'.</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-blue-800 mb-1">Marking as delivered</p>
            <p className="text-sm text-gray-600">Tap '✓ Mark Delivered' on any pending signup to mark it done on their behalf. Use this if a volunteer forgot to mark it themselves.</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-amber-800 mb-1">Nudging pending volunteers</p>
            <p className="text-sm text-gray-600">Tap '📞 Nudge (N)' to see call and WhatsApp buttons for every volunteer who hasn't delivered yet.</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-800 mb-1">Removing a signup</p>
            <p className="text-sm text-gray-600">Tap 'Remove' on any signup to delete it. This cannot be undone.</p>
          </div>
        </div>
      </Section>

      <Section title="Confirming Deliveries" color="bg-green-100 text-green-800">
        <p className="text-sm text-gray-600 leading-relaxed">
          When a volunteer marks their own delivery in the app, they upload a photo. You'll see a yellow banner on the Dates tab: <strong>"📸 Confirm This Week's Deliveries"</strong>.
        </p>
        <Step n={1} icon="📸" title="Review the photo"
          body="Tap the volunteer's card to see the photo they uploaded as proof of delivery." />
        <Step n={2} icon="✅" title="Tap Confirm"
          body="Tapping '✓ Confirm' marks the signup as Confirmed (shown with a green ✅). This is the final status." />
        <p className="text-sm text-gray-500">If a volunteer didn't upload a photo, you can still manually mark them as delivered using the '✓ Mark Delivered' button.</p>
      </Section>

      <Section title="Different Address for Specific Weeks" color="bg-teal-100 text-teal-800">
        <p className="text-sm text-gray-600 leading-relaxed">
          Need volunteers to drop off at a different location for one particular date? You can override the address per event.
        </p>
        <Step n={1} icon="📅" title="Open the event"
          body="Tap the delivery date on the Dates tab." />
        <Step n={2} icon="✏️" title="Tap 'Edit'"
          body="Tap the 'Edit' button in the top right of the event card." />
        <Step n={3} icon="📍" title="Change the Drop-Off Location"
          body="Clear the address field and type the new address. This only affects this specific date — your default address in Settings is unchanged." />
        <Step n={4} icon="💾" title="Tap 'Save Changes'"
          body="Volunteers will now see the new address on their signup page for this date." />
      </Section>

      <Section title="Sending Reminders" color="bg-purple-100 text-purple-800">
        <p className="text-sm text-gray-600 leading-relaxed">
          During delivery week (Sunday through delivery day), each event card shows a purple reminder section.
        </p>
        <div className="bg-purple-50 rounded-xl p-3 space-y-2">
          <Tip icon="📋" text="'Copy Group Message' — a pre-written WhatsApp message with the delivery details and volunteer list. Paste it into your WhatsApp group." />
          <Tip icon="💬" text="Individual WA buttons — tap any volunteer's name to open a pre-written personal reminder in WhatsApp." />
        </div>
        <p className="text-xs text-gray-400">The automated Twilio reminder system (when set up) will handle this automatically in the future.</p>
      </Section>

      <Section title="Managing Your Contact List" color="bg-indigo-100 text-indigo-800">
        <p className="text-sm text-gray-600 leading-relaxed">
          The Members tab shows all volunteers who have ever signed up with you, along with their total meal bag and nutritional delivery counts.
        </p>
        <div className="space-y-2">
          <Tip icon="🔢" text="Delivery counts are calculated automatically from signup history." />
          <Tip icon="✏️" text="You can manually adjust counts (e.g. for deliveries before the app existed) by tapping 'Adjust' next to any volunteer." />
          <Tip icon="📋" text="'Export CSV' on the Dates tab downloads a spreadsheet of all signups, filterable by month. Useful for records or tax documentation." />
          <Tip icon="🗑" text="You can remove a volunteer and all their history from the Members tab — this is permanent." />
        </div>
      </Section>

      <Section title="Settings" color="bg-gray-100 text-gray-700">
        <div className="space-y-2">
          {[
            { label: 'Name', desc: 'Your display name shown to volunteers on the member page.' },
            { label: 'Phone', desc: 'Your WhatsApp-enabled number. Volunteers can tap to call or message you directly from the member page.' },
            { label: 'Default Address', desc: 'The drop-off address shown for all events. Can be overridden per event.' },
            { label: 'Password', desc: 'Change your dashboard login password.' },
            { label: 'Signup Open Day', desc: 'Which day of the month signups open (default: 15th). You can also set a manual override date.' },
            { label: 'Signup Close Override', desc: 'Force signups to close on a specific date, regardless of the event date.' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-2.5">
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5 whitespace-nowrap">{label}</span>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Frequently Asked Questions" color="bg-gray-100 text-gray-700">
        <div className="space-y-3">
          <QA q="A volunteer signed up twice. What do I do?" a="Open the event detail, find the duplicate signup, and tap 'Remove' on the extra one." />
          <QA q="A volunteer delivered but didn't mark it in the app. How do I fix it?" a="Open the event, find their signup, and tap '✓ Mark Delivered'. You can do this at any time." />
          <QA q="How do I add a volunteer to a date that's in the past?" a="Open the past event from the Dates tab (scroll down to 'Past'), tap '+ Add Member', and fill in their info." />
          <QA q="Can two coordinators use the same app?" a="Yes — each coordinator has their own account and their own signup link. Volunteers signing up via your link are only visible to you." />
          <QA q="What happens when I create dates — do volunteers get notified automatically?" a="Yes, if they're on your contact list. When you create dates, all contacts receive a WhatsApp message with your signup link. (Requires Twilio to be set up.)" />
          <QA q="I need to cancel a delivery date entirely. What do I do?" a="Open the event, tap 'Edit', then scroll to 'Delete' at the top right. This removes the date and all signups. Notify your volunteers separately." />
        </div>
      </Section>

      <div className="bg-gray-800 rounded-2xl p-4 text-center">
        <p className="text-2xl mb-1">🙏</p>
        <p className="font-semibold text-white text-base">Thank you for coordinating!</p>
        <p className="text-sm text-gray-300 mt-1">Questions? Contact Ishaan or Anupama via WhatsApp.</p>
      </div>

    </div>
  );
}

export default function GuidePage() {
  const [tab, setTab] = useState<'volunteer' | 'coordinator'>('volunteer');

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <Link href="/" className="text-orange-500 text-base font-medium">← Home</Link>
        <h1 className="font-bold text-gray-800 text-lg mx-auto">App Guide</h1>
        <div className="w-12" />
      </header>

      <div className="flex bg-white border-b border-orange-100">
        <button
          onClick={() => setTab('volunteer')}
          className={`flex-1 py-3.5 text-base font-semibold transition-colors ${tab === 'volunteer' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'}`}
        >
          For Volunteers
        </button>
        <button
          onClick={() => setTab('coordinator')}
          className={`flex-1 py-3.5 text-base font-semibold transition-colors ${tab === 'coordinator' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'}`}
        >
          For Coordinators
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-8">
        {tab === 'volunteer' ? <VolunteerGuide /> : <CoordinatorGuide />}
      </div>
    </div>
  );
}
