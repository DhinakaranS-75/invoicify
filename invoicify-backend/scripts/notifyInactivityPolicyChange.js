// One-time script — emails every existing user about the new inactivity
// policy (15/25/30/37-day schedule) BEFORE it goes live, so no one is
// surprised by it later. Run this once, right after deploying the
// inactivity-check feature.
//
// USAGE:
//   node scripts/notifyInactivityPolicyChange.js            -> dry run (safe, no emails sent)
//   node scripts/notifyInactivityPolicyChange.js --apply     -> actually sends the emails
//
// NOTE ON BREVO FREE TIER: 300 emails/day. If you have more than ~290
// users, this script only sends the first batch per run — just run it
// again on subsequent days until "Remaining after this run: 0".

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User.js';
import { sendInactivityPolicyAnnouncement } from '../utils/mailer.js';

const apply = process.argv.includes('--apply');
const DAILY_SAFETY_LIMIT = 290; // stay under Brevo's 300/day free-tier cap

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is missing. Run this from the backend folder with your .env in place.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected.\n');

  // Only users who haven't been notified yet — lets this script be re-run
  // safely across multiple days if you have more users than the daily
  // email quota allows, without re-sending to anyone.
  const pending = await User.find({ inactivityPolicyNotifiedAt: { $exists: false } }, 'email name');
  console.log(`Users not yet notified: ${pending.length}`);

  if (pending.length === 0) {
    console.log('Nothing to do — everyone has already been notified.');
    await mongoose.disconnect();
    return;
  }

  const batch = pending.slice(0, DAILY_SAFETY_LIMIT);
  console.log(`This run will handle: ${batch.length} (Brevo free-tier daily safety limit: ${DAILY_SAFETY_LIMIT})`);

  if (!apply) {
    console.log('\nThis was a DRY RUN — no emails were sent.');
    console.log('Sample recipients:', batch.slice(0, 5).map((u) => u.email).join(', ') + (batch.length > 5 ? ', ...' : ''));
    console.log('\nRe-run with --apply to actually send:\n');
    console.log('  node scripts/notifyInactivityPolicyChange.js --apply\n');
    await mongoose.disconnect();
    return;
  }

  console.log('\nSending...\n');
  let sent = 0, failed = 0;
  for (const user of batch) {
    try {
      await sendInactivityPolicyAnnouncement({ email: user.email, name: user.name });
      await User.updateOne({ _id: user._id }, { $set: { inactivityPolicyNotifiedAt: new Date() } });
      sent += 1;
    } catch (err) {
      console.error(`  Failed for ${user.email}: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\n✅ Sent: ${sent}   ❌ Failed: ${failed}`);
  console.log(`Remaining after this run: ${pending.length - batch.length}`);
  if (pending.length - batch.length > 0) {
    console.log('Run this script again (tomorrow, for the Brevo daily quota to reset) to notify the rest.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
