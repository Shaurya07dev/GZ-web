export type OrderStatus =
  | "pending" | "paid" | "confirmed" | "packed" | "transit"
  | "delivered" | "cancelled";

export interface OrderStatusEvent {
  status: OrderStatus;
  changedAt: string; // ISO date
}

export interface Order {
  id: string;
  artworkId: string;
  addressId: string;
  amount: number; // artwork's customerPrice at time of purchase
  gstAmount: number;
  deliveryCharge: number;
  status: OrderStatus;
  createdAt: string; // ISO date
  statusHistory: OrderStatusEvent[];
}
