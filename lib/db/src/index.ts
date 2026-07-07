import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | undefined;

export function connectDatabase(uri = process.env.MONGODB_URI): Promise<typeof mongoose> {
  if (!uri) throw new Error("MONGODB_URI must be set");
  mongoose.set("transactionAsyncLocalStorage", true);
  connectionPromise ??= mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10_000,
  });
  return connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  connectionPromise = undefined;
}

export { mongoose };

export * from "./schema";
