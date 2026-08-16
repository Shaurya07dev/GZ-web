import type { AggregatorSale, GallerySpace } from "@/types/aggregator";
import type { Settlement } from "@/types/admin";
import type { WalletTransaction } from "@/features/dashboard/dashboard-data";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  aggregatorSalesCol,
  aggregatorGallerySpacesCol,
  aggregatorWalletCol,
  aggregatorWalletTransactionsCol,
  aggregatorSettlementsCol,
  aggregatorProfileCol,
  holdingsCol,
} from "@/lib/mock-collections";

export interface AggregatorCustomer {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  orderCount: number;
  totalSpend: number;
}

// Shipment-relevant projection of AggregatorSale — same rows, fewer fields
// for the Shipping & Logistics outbound table.
export interface AggregatorShipment {
  id: string;
  artworkId: string;
  holdingId: string;
  buyerName: string;
  deliveryMode: AggregatorSale["deliveryMode"];
  deliveryAddress: AggregatorSale["deliveryAddress"];
  shipmentStatus: AggregatorSale["shipmentStatus"];
  soldAt: string;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  courierRef: string | null;
}

export interface AggregatorAnalyticsSummary {
  // Derived from live sales/holdings — Task 7's analytics page may overlay
  // pre-baked demo series on top; this summary stays honest to fixture data.
  salesCount: number;
  totalRevenue: number;
  totalCommissionPending: number;
  totalCommissionAvailable: number;
  customerCount: number;
  activeReservations: number;
  averageSoldPrice: number;
  averageDisplayMarkup: number;
}

function toShipment(sale: AggregatorSale): AggregatorShipment {
  return {
    id: sale.id,
    artworkId: sale.artworkId,
    holdingId: sale.holdingId,
    buyerName: sale.buyerName,
    deliveryMode: sale.deliveryMode,
    deliveryAddress: sale.deliveryAddress,
    shipmentStatus: sale.shipmentStatus,
    soldAt: sale.soldAt,
    dispatchedAt: sale.dispatchedAt,
    deliveredAt: sale.deliveredAt,
    courierRef: sale.courierRef,
  };
}

function commissionForSale(sale: AggregatorSale): number {
  const holding = holdingsCol.get().find((h) => h.id === sale.holdingId);
  const artwork = getArtworkById(sale.artworkId);
  if (!holding || !artwork) return 0;
  return Math.round(
    0.2 * Math.max(0, holding.displayPrice - artwork.customerPrice),
  );
}

export const aggregatorSalesService = {
  listSales: (): Promise<AggregatorSale[]> =>
    mockDelay(aggregatorSalesCol.get()),

  listCustomers: (): Promise<AggregatorCustomer[]> => {
    const byEmail = new Map<string, AggregatorCustomer>();
    for (const sale of aggregatorSalesCol.get()) {
      const existing = byEmail.get(sale.buyerEmail);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpend += sale.soldPrice;
        // Keep the most recent name/phone if the buyer updates details later.
        existing.buyerName = sale.buyerName;
        existing.buyerPhone = sale.buyerPhone;
      } else {
        byEmail.set(sale.buyerEmail, {
          buyerName: sale.buyerName,
          buyerEmail: sale.buyerEmail,
          buyerPhone: sale.buyerPhone,
          orderCount: 1,
          totalSpend: sale.soldPrice,
        });
      }
    }
    return mockDelay([...byEmail.values()]);
  },

  listShipments: (): Promise<AggregatorShipment[]> =>
    mockDelay(aggregatorSalesCol.get().map(toShipment)),

  advanceShipment: (saleId: string): Promise<AggregatorSale> => {
    const sales = aggregatorSalesCol.get();
    const index = sales.findIndex((s) => s.id === saleId);
    if (index === -1) return mockError("Sale not found");

    const sale = sales[index];
    const now = new Date().toISOString();
    let updated: AggregatorSale;

    if (sale.shipmentStatus === "preparing") {
      updated = { ...sale, shipmentStatus: "dispatched", dispatchedAt: now };
    } else if (sale.shipmentStatus === "dispatched") {
      updated = { ...sale, shipmentStatus: "delivered", deliveredAt: now };
    } else {
      return mockError("Shipment is already delivered");
    }

    aggregatorSalesCol.set(sales.map((s, i) => (i === index ? updated : s)));
    return mockDelay(updated);
  },

  listGallerySpaces: (): Promise<GallerySpace[]> =>
    mockDelay(aggregatorGallerySpacesCol.get()),

  listWallet: (): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
  }> => mockDelay(aggregatorWalletCol.get()),

  listWalletTransactions: (): Promise<WalletTransaction[]> =>
    mockDelay(aggregatorWalletTransactionsCol.get()),

  requestWithdrawal: (amount: number): Promise<WalletTransaction> => {
    const wallet = aggregatorWalletCol.get();
    if (amount < 1000) return mockError("Minimum withdrawal is ₹1,000");
    if (amount > wallet.balance)
      return mockError("Exceeds your available balance");

    aggregatorWalletCol.set({ ...wallet, balance: wallet.balance - amount });

    const transaction: WalletTransaction = {
      id: `wt-${crypto.randomUUID().slice(0, 8)}`,
      type: "withdrawal",
      label: `Withdrawal to bank ${aggregatorProfileCol.get().bankAccountMasked.slice(-4)}`,
      amount: -amount,
      date: new Date().toISOString().slice(0, 10),
      status: "completed",
    };
    aggregatorWalletTransactionsCol.set([
      transaction,
      ...aggregatorWalletTransactionsCol.get(),
    ]);

    return mockDelay(transaction);
  },

  listSettlements: (): Promise<Settlement[]> =>
    mockDelay(aggregatorSettlementsCol.get()),

  // Manual "simulate settlement": pending commission → available balance,
  // and append a Settlement row. No automatic timer — same honesty posture
  // as Admin's retry-on-failed-settlements action.
  processSettlement: (saleId: string): Promise<Settlement> => {
    const sale = aggregatorSalesCol.get().find((s) => s.id === saleId);
    if (!sale) return mockError("Sale not found");

    const alreadySettled = aggregatorSettlementsCol
      .get()
      .some((s) => s.orderId === saleId);
    if (alreadySettled) return mockError("Settlement already processed");

    const commission = commissionForSale(sale);
    if (commission <= 0) {
      return mockError("No commission to settle for this sale");
    }

    const transactions = aggregatorWalletTransactionsCol.get();
    const artwork = getArtworkById(sale.artworkId);
    const txIndex = transactions.findIndex(
      (t) =>
        t.type === "commission" &&
        t.status === "pending" &&
        t.amount === commission &&
        (artwork ? t.label.includes(artwork.title) : true),
    );
    if (txIndex === -1) {
      return mockError("No pending commission found for this sale");
    }

    const wallet = aggregatorWalletCol.get();
    if (wallet.pendingBalance < commission) {
      return mockError("Insufficient pending balance to settle");
    }

    aggregatorWalletCol.set({
      ...wallet,
      pendingBalance: wallet.pendingBalance - commission,
      balance: wallet.balance + commission,
    });

    const updatedTx: WalletTransaction = {
      ...transactions[txIndex],
      status: "completed",
      type: "settlement",
      label: artwork
        ? `Settlement: "${artwork.title}"`
        : transactions[txIndex].label,
    };
    aggregatorWalletTransactionsCol.set(
      transactions.map((t, i) => (i === txIndex ? updatedTx : t)),
    );

    const now = new Date().toISOString();
    const settlement: Settlement = {
      id: `settle-${crypto.randomUUID().slice(0, 8)}`,
      orderId: saleId,
      artworkTitle: artwork?.title ?? sale.artworkId,
      artistName: artwork?.artistName ?? "—",
      artistAmount: 0,
      aggregatorCommission: commission,
      platformRevenue: 0,
      status: "processed",
      createdAt: sale.soldAt,
      processedAt: now,
    };
    aggregatorSettlementsCol.set([
      settlement,
      ...aggregatorSettlementsCol.get(),
    ]);

    return mockDelay(settlement);
  },

  getAnalytics: (): Promise<AggregatorAnalyticsSummary> => {
    const sales = aggregatorSalesCol.get();
    const holdings = holdingsCol.get();
    const wallet = aggregatorWalletCol.get();
    const customers = new Set(sales.map((s) => s.buyerEmail));

    const totalRevenue = sales.reduce((sum, s) => sum + s.soldPrice, 0);
    const markups = sales.map((sale) => {
      const holding = holdings.find((h) => h.id === sale.holdingId);
      const artwork = getArtworkById(sale.artworkId);
      if (!holding || !artwork) return 0;
      return Math.max(0, holding.displayPrice - artwork.customerPrice);
    });
    const averageDisplayMarkup =
      markups.length > 0
        ? Math.round(markups.reduce((a, b) => a + b, 0) / markups.length)
        : 0;

    return mockDelay({
      salesCount: sales.length,
      totalRevenue,
      totalCommissionPending: wallet.pendingBalance,
      totalCommissionAvailable: wallet.balance,
      customerCount: customers.size,
      activeReservations: holdings.filter((h) => h.status === "reserved")
        .length,
      averageSoldPrice:
        sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      averageDisplayMarkup,
    });
  },
};
