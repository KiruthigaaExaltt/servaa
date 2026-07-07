import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { connectDatabase, disconnectDatabase, InventoryItem, InventoryMovement, LedgerEntry, mongoose, Order, Outlet, Table, User } from "@workspace/db";
import { hashPin } from "./lib/security";

const uri = process.env.MONGODB_TEST_URI;
const integration = uri ? test : test.skip;
let server: Server;
let base = "";
let cookie = "";

before(async () => {
  if (!uri) return;
  if (!/servaa[_-]test/i.test(uri)) throw new Error("MONGODB_TEST_URI must target a clearly named Servaa test database");
  process.env.AUTH_SECRET = "integration-test-secret-at-least-32-characters";
  process.env.DEFAULT_OUTLET_SLUG = "servaa-test";
  await connectDatabase(uri);
  await mongoose.connection.dropDatabase();
  const outlet = await Outlet.create({ slug: "servaa-test", name: "Servaa Test", tax: { cgstPct: 2.5, sgstPct: 2.5 } });
  await User.create({ outletId: outlet._id, legacyId: "admin", name: "Admin", role: "Admin", pinHash: hashPin("1234"), active: true });
  const app = (await import("./app")).default;
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", () => resolve()); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  base = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (!uri) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", "x-outlet-slug": "servaa-test", ...(cookie ? { cookie } : {}), ...init.headers } });
}

integration("authenticates and protects collection resources", async () => {
  assert.equal((await request("/collections/inventory_items")).status, 401);
  const login = await request("/auth/pin", { method: "POST", body: JSON.stringify({ role: "Admin", pin: "1234" }) });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.match(cookie, /^servaa_session=/);
});

integration("writes authoritative typed collections and rejects stale revisions", async () => {
  const value = [{ id: "inv-test", name: "Rice", category: "Grains", stock: 10, minLevel: 2, unit: "KG", unitPrice: 100, lastRestocked: "2026-01-01", supplierName: "Supplier", supplierContact: "1" }];
  const created = await request("/collections/inventory_items", { method: "PUT", headers: { "if-match": "0" }, body: JSON.stringify({ value }) });
  assert.equal(created.status, 200);
  assert.equal((await InventoryItem.countDocuments({ legacyId: "inv-test" })), 1);
  const stale = await request("/collections/inventory_items", { method: "PUT", headers: { "if-match": "0" }, body: JSON.stringify({ value }) });
  assert.equal(stale.status, 409);
});

integration("commits GRN, movement and ledger atomically", async () => {
  const response = await request("/inventory/grn", { method: "POST", body: JSON.stringify({ id: "grn-test", inventoryId: "inv-test", itemName: "Rice", unit: "KG", batchNumber: "B-1", qtyReceived: 5, unitCost: 110, supplierName: "Supplier", resultingStock: 15, receivedAt: Date.now() }) });
  assert.equal(response.status, 201);
  assert.equal((await InventoryItem.findOne({ legacyId: "inv-test" }))?.stock, 15);
  assert.equal(await InventoryMovement.countDocuments({ sourceType: "goods_receipt" }), 1);
  assert.equal(await LedgerEntry.countDocuments({ legacyId: "grn:grn-test" }), 1);
});

integration("settles an order idempotently inside the replica-set transaction", async () => {
  const outlet = await Outlet.findOne({ slug: "servaa-test" });
  await Table.create({ outletId: outlet!._id, legacyId: "T-1", status: "Occupied", currentSession: { kind: "active" } });
  const body = { idempotencyKey: "txn-test", tableId: "T-1", meta: { tableId: "T-1", waiterName: "Admin" }, lines: [{ id: "l1", name: "Rice", quantity: 1, price: 100 }], subtotal: 100, discount: 0, cgst: 2.5, sgst: 2.5, total: 105, paymentMethod: "Cash", role: "Admin" };
  assert.equal((await request("/transactions/settle", { method: "POST", body: JSON.stringify(body) })).status, 201);
  assert.equal((await request("/transactions/settle", { method: "POST", body: JSON.stringify(body) })).status, 201);
  assert.equal(await Order.countDocuments({ legacyId: "txn-test" }), 1);
  assert.equal((await Table.findOne({ legacyId: "T-1" }))?.status, "Cleaning");
});
