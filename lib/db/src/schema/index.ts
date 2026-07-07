import mongoose, { type Model, type Schema as MongooseSchema } from "mongoose";

const { Schema, model, models } = mongoose;

const id = Schema.Types.ObjectId;
const timestamps = { timestamps: true, versionKey: "version" } as const;
const money = { type: Number, min: 0, default: 0 } as const; // integer paise
const outletScoped = {
  outletId: { type: id, ref: "Outlet", required: true, index: true },
  clientPayload: { type: Schema.Types.Mixed, select: false },
};

function existing<T>(name: string, schema: MongooseSchema<T>): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

const snapshotSchema = new Schema({}, { _id: false, strict: false });
const lineSchema = new Schema(
  {
    legacyId: String,
    itemId: { type: id, ref: "MenuItem" },
    name: { type: String, required: true },
    quantity: { type: Number, min: 0, required: true },
    unitPricePaise: money,
    modifiers: [String],
    status: String,
    stationId: String,
    isVoided: { type: Boolean, default: false },
    voidReason: String,
  },
  { _id: true, strict: false },
);

export const Outlet = existing("Outlet", new Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  gstin: String, address: String, phone: String,
  tax: { cgstPct: { type: Number, min: 0, max: 50 }, sgstPct: { type: Number, min: 0, max: 50 } },
  stations: [{ legacyId: String, label: String, builtIn: Boolean }],
  invoiceSequence: { type: Number, min: 0, default: 0 },
}, timestamps));

const userSchema = new Schema({ ...outletScoped,
  legacyId: String,
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  role: { type: String, required: true, enum: ["Admin", "Manager", "Cashier", "Server", "Kitchen"] },
  pinHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
}, timestamps);
userSchema.index({ outletId: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string", $gt: "" } } });
userSchema.index({ outletId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });
export const User = existing("User", userSchema);

const zoneSchema = new Schema({ ...outletScoped, legacyId: String, label: { type: String, required: true }, color: String, sortOrder: Number }, timestamps);
zoneSchema.index({ outletId: 1, legacyId: 1 }, { unique: true });
export const Zone = existing("Zone", zoneSchema);

const tableSchema = new Schema({ ...outletScoped,
  legacyId: { type: String, required: true }, zoneId: { type: id, ref: "Zone" }, zoneLegacyId: String,
  capacity: { type: Number, min: 1 }, type: String, isActive: { type: Boolean, default: true }, qrCode: String,
  x: Number, y: Number, qrMenuVersion: String, qrLastUsed: Date,
  status: { type: String, default: "Vacant", index: true }, pax: Number, waiterName: String,
  customerName: String, occupiedSince: Date,
  currentSession: { type: snapshotSchema, default: null },
  adminView: snapshotSchema,
  fohView: snapshotSchema,
}, timestamps);
tableSchema.index({ outletId: 1, legacyId: 1 }, { unique: true });
tableSchema.index({ outletId: 1, status: 1 });
export const Table = existing("Table", tableSchema);

const categorySchema = new Schema({ ...outletScoped, legacyId: String, label: String, sortOrder: Number }, timestamps);
categorySchema.index({ outletId: 1, legacyId: 1 }, { unique: true });
export const MenuCategory = existing("MenuCategory", categorySchema);

const menuItemSchema = new Schema({ ...outletScoped,
  legacyId: String, name: { type: String, required: true }, description: String,
  categoryId: { type: id, ref: "MenuCategory" }, categoryLegacyId: String, station: String,
  basePricePaise: money, isVeg: Boolean, imageSeed: String, isAvailable: Boolean,
  taxCategory: String, discountEligible: Boolean, dietaryTags: [String],
  variants: [snapshotSchema], addons: [snapshotSchema], dynamicPricing: snapshotSchema,
}, timestamps);
menuItemSchema.index({ outletId: 1, legacyId: 1 }, { unique: true });
menuItemSchema.index({ outletId: 1, categoryId: 1, isAvailable: 1 });
export const MenuItem = existing("MenuItem", menuItemSchema);

const comboSchema = new Schema({ ...outletScoped, legacyId: String, name: String, description: String,
  imageSeed: String, comboPricePaise: money, slots: [snapshotSchema], isAvailable: Boolean,
  taxCategory: String, isVeg: Boolean,
}, timestamps);
comboSchema.index({ outletId: 1, legacyId: 1 }, { unique: true });
export const Combo = existing("Combo", comboSchema);

const orderSchema = new Schema({ ...outletScoped, legacyId: String, invoiceNumber: String,
  tableId: { type: id, ref: "Table" }, tableLegacyId: String, customerId: { type: id, ref: "Customer" },
  meta: snapshotSchema, lines: [lineSchema], subtotalPaise: money, discountPaise: money,
  cgstPaise: money, sgstPaise: money, totalPaise: money, paymentMethod: String,
  amountTenderedPaise: money, changeReturnedPaise: money,
  status: { type: String, default: "Settled" }, settledAt: { type: Date, default: Date.now }, auditEvents: [snapshotSchema],
  refundedAt: Date, refundReason: String,
}, timestamps);
orderSchema.index({ outletId: 1, invoiceNumber: 1 }, { unique: true, partialFilterExpression: { invoiceNumber: { $type: "string" } } });
orderSchema.index({ outletId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });
orderSchema.index({ outletId: 1, settledAt: -1, status: 1 });
export const Order = existing("Order", orderSchema);

const kotSchema = new Schema({ ...outletScoped, legacyId: String, orderId: { type: id, ref: "Order" },
  orderLegacyId: String, tableId: { type: id, ref: "Table" }, tableLegacyId: String,
  waiterName: String, orderSource: String, orderType: String, guestCount: Number,
  customerName: String, customerPhone: String, firedAt: { type: Date, default: Date.now }, items: [lineSchema], closedAt: Date,
}, timestamps);
kotSchema.index({ outletId: 1, tableLegacyId: 1, closedAt: 1 });
export const KOT = existing("KOT", kotSchema);

function scopedModel(name: string, fields: Record<string, unknown>, indexes: Array<[Record<string, 1 | -1>, Record<string, unknown>?]> = []) {
  const schema = new Schema({ ...outletScoped, ...fields }, timestamps);
  const hasLegacyIndex = indexes.some(([keys]) => Object.hasOwn(keys, "legacyId"));
  if (Object.hasOwn(fields, "legacyId") && !hasLegacyIndex) schema.index({ outletId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return existing(name, schema);
}

export const Reservation = scopedModel("Reservation", { legacyId: String, customerId: { type: id, ref: "Customer" }, tableId: { type: id, ref: "Table" }, seatedTableLegacyId: String, guestName: String, phone: String, pax: Number, reservationAt: Date, status: String, note: String }, [[{ outletId: 1, reservationAt: 1, status: 1 }]]);
export const WaitlistEntry = scopedModel("WaitlistEntry", { legacyId: String, customerId: { type: id, ref: "Customer" }, guestName: String, phone: String, pax: Number, quotedWait: Number, joinedAt: Date, note: String }, [[{ outletId: 1, joinedAt: 1 }]]);
export const Tip = scopedModel("Tip", { legacyId: String, orderId: { type: id, ref: "Order" }, tableId: { type: id, ref: "Table" }, tableLegacyId: String, userId: { type: id, ref: "User" }, staff: String, amountPaise: money, paymentMethod: String, at: Date });

const customerSchema = new Schema({ ...outletScoped, legacyId: String, name: String, phone: String,
  normalizedPhone: String, email: String, joinedAt: Date, visits: { type: Number, default: 0 },
  lifetimeSpendPaise: money, points: { type: Number, default: 0 }, lastVisitAt: Date, birthday: String,
  tags: [String], preferences: String,
}, timestamps);
customerSchema.index({ outletId: 1, normalizedPhone: 1 }, { unique: true, partialFilterExpression: { normalizedPhone: { $type: "string", $gt: "" } } });
export const Customer = existing("Customer", customerSchema);
export const CustomerFeedback = scopedModel("CustomerFeedback", { legacyId: String, customerId: { type: id, ref: "Customer", required: true }, orderId: { type: id, ref: "Order" }, rating: { type: Number, min: 1, max: 5 }, visitDate: Date, comment: String, at: Date }, [[{ outletId: 1, customerId: 1, at: -1 }]]);

const inventorySchema = new Schema({ ...outletScoped, legacyId: String, name: String, category: String,
  stock: { type: Number, min: 0 }, minLevel: { type: Number, min: 0 }, unit: String,
  unitPricePaise: money, lastRestocked: Date, supplierId: { type: id, ref: "Supplier" }, supplierName: String, supplierContact: String,
}, timestamps);
inventorySchema.index({ outletId: 1, legacyId: 1 }, { unique: true });
inventorySchema.index({ outletId: 1, category: 1, stock: 1 });
export const InventoryItem = existing("InventoryItem", inventorySchema);
export const InventoryMovement = scopedModel("InventoryMovement", { inventoryItemId: { type: id, ref: "InventoryItem", required: true }, type: String, quantity: Number, unitCostPaise: money, sourceType: String, sourceId: id, userId: { type: id, ref: "User" }, at: Date }, [[{ outletId: 1, inventoryItemId: 1, at: -1 }]]);
InventoryMovement.schema.index({ outletId: 1, sourceType: 1, sourceId: 1, inventoryItemId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: "objectId" } } });
export const GoodsReceipt = scopedModel("GoodsReceipt", { legacyId: String, inventoryItemId: { type: id, ref: "InventoryItem" }, inventoryLegacyId: String, purchaseOrderId: { type: id, ref: "PurchaseOrder" }, itemName: String, unit: String, batchNumber: String, quantity: Number, unitCostPaise: money, supplierName: String, receivedAt: Date });
export const Recipe = scopedModel("Recipe", { legacyId: String, menuItemId: { type: id, ref: "MenuItem" }, menuItemLegacyId: String, ingredients: [snapshotSchema], notes: String });
export const PrepLog = scopedModel("PrepLog", { legacyId: String, recipeId: String, recipeName: String, yieldQty: Number, unit: String, preparedBy: String, consumption: [snapshotSchema], preparedAt: Date });
export const WastageEntry = scopedModel("WastageEntry", { legacyId: String, inventoryItemId: { type: id, ref: "InventoryItem" }, inventoryLegacyId: String, quantity: Number, reason: String, userId: { type: id, ref: "User" }, recordedBy: String, at: Date, note: String });
export const PrepTask = scopedModel("PrepTask", { legacyId: String, label: String, quantityLabel: String, station: String, done: Boolean, assigneeId: { type: id, ref: "User" }, assignee: String });

export const Supplier = scopedModel("Supplier", { legacyId: String, name: String, contactPerson: String, phone: String, email: String, address: String, gstin: String, paymentTermsDays: Number, categories: [String], rating: Number, active: Boolean }, [[{ outletId: 1, name: 1 }, { unique: true }]]);
const poSchema = new Schema({ ...outletScoped, legacyId: String, supplierId: { type: id, ref: "Supplier" }, supplierName: String,
  status: String, createdAt: Date, sentAt: Date, expectedAt: Date, receivedAt: Date, cancelledAt: Date,
  notes: String, vendorContact: String, paymentTermsDays: Number, deliveryAddress: String, externalReference: String,
  subtotalPaise: money, taxPaise: money, totalPaise: money, lines: [snapshotSchema],
}, timestamps);
poSchema.index({ outletId: 1, legacyId: 1 }, { unique: true });
poSchema.index({ outletId: 1, status: 1, createdAt: -1 });
export const PurchaseOrder = existing("PurchaseOrder", poSchema);

export const Employee = scopedModel("Employee", { legacyId: String, userId: { type: id, ref: "User" }, name: String, role: String, status: String, phone: String, email: String, joinedAt: Date, baseSalaryPaise: money, hourlyRatePaise: money, rating: Number, hoursThisWeek: Number, tipsThisMonthPaise: money, paid: Boolean, shifts: [snapshotSchema], punches: [snapshotSchema] }, [[{ outletId: 1, legacyId: 1 }, { unique: true }]]);
export const ShiftAssignment = scopedModel("ShiftAssignment", { employeeId: { type: id, ref: "Employee" }, date: Date, day: Number, slot: String, zoneId: { type: id, ref: "Zone" }, zone: String });
export const ClockEvent = scopedModel("ClockEvent", { legacyId: String, employeeId: { type: id, ref: "Employee" }, staffId: String, staffName: String, role: String, type: { type: String, enum: ["clock_in", "clock_out"] }, at: Date, note: String }, [[{ outletId: 1, employeeId: 1, at: -1 }]]);
export const RolePolicy = scopedModel("RolePolicy", { role: String, permissions: [String], modules: [String] }, [[{ outletId: 1, role: 1 }, { unique: true }]]);

export const LoyaltyConfig = scopedModel("LoyaltyConfig", { pointsPerRupee: Number, rupeePerPoint: Number, signupBonus: Number, birthdayBonus: Number, tiers: [snapshotSchema] });
export const Campaign = scopedModel("Campaign", { legacyId: String, name: String, channel: String, templateId: { type: id, ref: "MessageTemplate" }, template: String, audience: String, reach: Number, status: String, sentAt: Date, scheduledAt: Date, spendPaise: money, revenuePaise: money, redemptions: Number });
export const MessageTemplate = scopedModel("MessageTemplate", { legacyId: String, name: String, subject: String, body: String, emoji: String });
export const Coupon = scopedModel("Coupon", { legacyId: String, code: { type: String, uppercase: true, trim: true }, kind: String, value: Number, description: String, minSpendPaise: money, expiresAt: Date, active: Boolean, issued: Number, redeemed: Number }, [[{ outletId: 1, code: 1 }, { unique: true }]]);

export const LedgerEntry = scopedModel("LedgerEntry", { legacyId: String, type: { type: String, enum: ["income", "expense"] }, sourceType: String, sourceId: id, originalEntryId: { type: id, ref: "LedgerEntry" }, at: Date, tableLabel: String, description: String, category: String, amountPaise: money, paymentMode: String, server: String, hasBill: Boolean, party: String }, [[{ outletId: 1, at: -1, type: 1 }], [{ outletId: 1, sourceType: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: "objectId" } } }]]);
export const VendorPayout = scopedModel("VendorPayout", { legacyId: String, purchaseOrderId: { type: id, ref: "PurchaseOrder" }, purchaseOrderLegacyId: String, vendor: String, category: String, amountPaise: money, paidPaise: money, dueAt: Date, status: String });

export const Rider = scopedModel("Rider", { legacyId: String, name: String, phone: String, vehicle: String, status: String, todayDeliveries: Number, rating: Number });
export const DeliveryOrder = scopedModel("DeliveryOrder", { legacyId: String, orderId: { type: id, ref: "Order" }, source: String, externalRef: String, customerId: { type: id, ref: "Customer" }, customerName: String, customerPhone: String, address: String, lines: [lineSchema], totalPaise: money, receivedAt: Date, readyAt: Date, pickedAt: Date, deliveredAt: Date, status: String, riderId: { type: id, ref: "Rider" }, riderLegacyId: String, notes: String }, [[{ outletId: 1, source: 1, externalRef: 1 }, { unique: true, partialFilterExpression: { externalRef: { $type: "string" } } }], [{ outletId: 1, status: 1, receivedAt: -1 }]]);
export const AggregatorConfig = scopedModel("AggregatorConfig", { legacyId: String, source: String, sync: Boolean, snoozeUntil: Date }, [[{ outletId: 1, source: 1 }, { unique: true }]]);

const auditSchema = new Schema({ ...outletScoped, legacyId: String, at: { type: Date, default: Date.now, immutable: true }, userId: { type: id, ref: "User", immutable: true }, role: { type: String, immutable: true }, actor: { type: String, immutable: true }, action: { type: String, immutable: true }, detail: { type: String, immutable: true }, module: { type: String, immutable: true }, entityType: { type: String, immutable: true }, entityId: { type: id, immutable: true } }, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
auditSchema.index({ outletId: 1, at: -1 });
auditSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"], function () { throw new Error("Audit entries are immutable"); });
export const AuditEntry = existing("AuditEntry", auditSchema);

const collectionRevisionSchema = new Schema({
  outletId: { type: id, ref: "Outlet", required: true, index: true },
  resource: { type: String, required: true },
  revision: { type: Number, required: true, min: 0, default: 0 },
}, timestamps);
collectionRevisionSchema.index({ outletId: 1, resource: 1 }, { unique: true });
export const CollectionRevision = existing("CollectionRevision", collectionRevisionSchema);
