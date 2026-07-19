import mongoose from 'mongoose';

// Connects to MongoDB Atlas using the URI from your .env file.
export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('❌ MONGODB_URI is missing. Did you create a .env file?');
      process.exit(1);
    }
    const conn = await mongoose.connect(uri);
    console.log(`   🍃  MongoDB       →  connected (${conn.connection.host})`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}
