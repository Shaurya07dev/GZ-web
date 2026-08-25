import type { Address, CustomerProfile } from "@/types/customer";
import type { Order, OrderStatus } from "@/types/order";

// ---------------------------------------------------------------------------
// Mirrors dashboard-data.ts's ARTIST / aggregator-data.ts's AGGREGATOR
// pattern: there is no real customer auth/session in this mock phase, so
// this is a single static "logged in as" fixture every Account page and
// the Checkout flow revolves around.
//
// Fixed "today" anchor matching every other mock-data file's own internal
// TODAY constant (2026-08-11T00:00:00.000Z) — see artworks.ts/
// aggregator-holdings.ts for why real Date.now() is deliberately avoided.
// ---------------------------------------------------------------------------

const TODAY = new Date("2026-08-11T00:00:00.000Z");

function daysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function history(...entries: Array<[OrderStatus, number]>) {
  return entries.map(([status, days]) => ({
    status,
    changedAt: daysAgo(days),
  }));
}

export const mockCustomer: CustomerProfile = {
  name: "Aarav Shah",
  email: "aarav.shah@example.com",
  phone: "+919812345678",
  joinedAt: "2025-11-04T00:00:00.000Z",
};

export const mockAddresses: Address[] = [
  {
    id: "addr-home-pune",
    line1: "12 MG Road",
    line2: "Flat 4B, Sunrise Apartments",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    isDefault: true,
  },
  {
    id: "addr-office-mumbai",
    line1: "88 Nariman Point",
    line2: "Tower 2, 14th Floor",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400021",
    isDefault: false,
  },
  {
    id: "addr-family-bengaluru",
    line1: "27 Indiranagar 100ft Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    isDefault: false,
  },
];

// artworkId values reference real entries in lib/mock-data/artworks.ts.
// amount/gstAmount/deliveryCharge follow orderService.create's exact
// math (5% GST, flat ₹250 delivery) so seeded and freshly-created orders
// look internally consistent.
export const mockOrders: Order[] = [
  {
    id: "order-monsoon-madurai",
    artworkId: "monsoon-over-madurai",
    addressId: "addr-home-pune",
    amount: 23400,
    gstAmount: 1170,
    deliveryCharge: 250,
    status: "delivered",
    createdAt: daysAgo(21),
    statusHistory: history(
      ["pending", 21],
      ["paid", 21],
      ["confirmed", 20],
      ["packed", 17],
      ["transit", 15],
      ["delivered", 11],
    ),
  },
  {
    id: "order-backwater-light",
    artworkId: "backwater-light-early-hours",
    addressId: "addr-home-pune",
    amount: 31200,
    gstAmount: 1560,
    deliveryCharge: 250,
    status: "transit",
    createdAt: daysAgo(6),
    statusHistory: history(
      ["pending", 6],
      ["paid", 6],
      ["confirmed", 5],
      ["packed", 3],
      ["transit", 1],
    ),
  },
  {
    id: "order-tide-line-dusk",
    artworkId: "tide-line-dusk",
    addressId: "addr-office-mumbai",
    amount: 18700,
    gstAmount: 935,
    deliveryCharge: 250,
    status: "confirmed",
    createdAt: daysAgo(2),
    statusHistory: history(["pending", 2], ["paid", 2], ["confirmed", 1]),
  },
  {
    id: "order-ancestral-bronze",
    artworkId: "ancestral-bronze-study",
    addressId: "addr-family-bengaluru",
    amount: 47450,
    gstAmount: 2372.5,
    deliveryCharge: 250,
    status: "paid",
    createdAt: daysAgo(1),
    statusHistory: history(["pending", 1], ["paid", 1]),
  },
  {
    id: "order-carved-marble-torso",
    artworkId: "carved-marble-torso",
    addressId: "addr-home-pune",
    amount: 62400,
    gstAmount: 3120,
    deliveryCharge: 250,
    status: "pending",
    createdAt: daysAgo(0),
    statusHistory: history(["pending", 0]),
  },
  {
    id: "order-reclaimed-stone-vessel",
    artworkId: "reclaimed-stone-vessel",
    addressId: "addr-office-mumbai",
    amount: 15600,
    gstAmount: 780,
    deliveryCharge: 250,
    status: "cancelled",
    createdAt: daysAgo(14),
    statusHistory: history(["pending", 14], ["cancelled", 13]),
  },
];
