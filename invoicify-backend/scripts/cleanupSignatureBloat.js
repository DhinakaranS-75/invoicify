// One-time cleanup script — removes the redundant `snapshot.signature`
// base64 blob that got duplicated into EVERY invoice/quote document.
//
// WHY THIS IS SAFE: When an invoice/quote is displayed or exported as PDF,
// the CURRENT company signature (from Settings) is always used first —
// see invoiceToDocData()/quoteToDocData() in the frontend, which do
// `signature: signature || s.signature || null`. The stored per-document
// copy only ever gets used as a fallback for the rare case where a
// company's signature was later removed. Stripping it frees real space
// with essentially no visible change for the vast majority of documents.
//
// USAGE:
//   node scripts/cleanupSignatureBloat.js            -> dry run (safe, no changes)
//   node scripts/cleanupSignatureBloat.js --apply     -> actually removes the field
//
// NOTE ON MONGODB ATLAS FREE TIER (M0): unsetting a field shrinks the
// LOGICAL document size immediately, but WiredTiger (the storage engine)
// doesn't always shrink the ON-DISK file size right away — that space is
// simply reused by future writes instead. So Atlas's storage-used number
// may not drop instantly after running this; what matters is that you now
// have real room to grow again. M0 clusters also don't support the
// `compact` command, so there isn't a way to force an instant reclaim.

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const apply = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is missing. Run this from the backend folder with your .env in place.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected.\n');

  const db = mongoose.connection.db;
  const invoicesCol = db.collection('invoices');
  const quotesCol = db.collection('quotes');

  const filter = { 'snapshot.signature': { $exists: true, $ne: null } };

  const [invoiceCount, quoteCount] = await Promise.all([
    invoicesCol.countDocuments(filter),
    quotesCol.countDocuments(filter)
  ]);

  console.log(`Invoices with a stored signature copy: ${invoiceCount}`);
  console.log(`Quotes with a stored signature copy:   ${quoteCount}`);

  // Estimate size from one sample document so the number printed below is
  // a real measurement of THIS database, not a guess.
  const sample = (await invoicesCol.findOne({ ...filter })) || (await quotesCol.findOne({ ...filter }));
  if (sample?.snapshot?.signature) {
    const perDocBytes = Buffer.byteLength(sample.snapshot.signature, 'utf8');
    const totalMB = (perDocBytes * (invoiceCount + quoteCount)) / (1024 * 1024);
    console.log(`Sample signature size: ~${(perDocBytes / 1024).toFixed(1)} KB per document`);
    console.log(`Estimated total space this is wasting: ~${totalMB.toFixed(2)} MB\n`);
  } else {
    console.log('No stored signatures found — nothing to clean up.\n');
    await mongoose.disconnect();
    return;
  }

  if (!apply) {
    console.log('This was a DRY RUN — no changes were made.');
    console.log('Re-run with --apply to actually remove these fields:\n');
    console.log('  node scripts/cleanupSignatureBloat.js --apply\n');
    await mongoose.disconnect();
    return;
  }

  console.log('Applying cleanup...\n');
  const [invRes, quoRes] = await Promise.all([
    invoicesCol.updateMany(filter, { $unset: { 'snapshot.signature': '' } }),
    quotesCol.updateMany(filter, { $unset: { 'snapshot.signature': '' } })
  ]);

  console.log(`✅ Invoices cleaned: ${invRes.modifiedCount}`);
  console.log(`✅ Quotes cleaned:   ${quoRes.modifiedCount}`);
  console.log('\nDone. Check Atlas → your cluster → Metrics/Storage in a few minutes.');
  console.log('(Number may not drop instantly on M0 — see the note at the top of this file.)');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
