// ---------- Basic aliases ----------
export type Poisha = number; // integer money. 100 poisha = 1 BDT
export type GroupId = string;
export type OptionId = string;
export type IngredientId = string;

// ---------- Menu ----------
export interface Option {
  id: OptionId;
  name: string;
  price: Poisha; // price of ONE unit of this option
  ingredients: Record<IngredientId, number>; // stock used per ONE unit
}

export interface Group {
  id: GroupId;
  name: string;
  min: number; // total units across group
  max: number;
  step?: number; // total must be a multiple of this
  maxDistinct?: number; // how many different options allowed
  maxPerOption?: number; // units of one single option
  options: Option[];
}

// ---------- Rules (data, never hardcode in logic) ----------
export type Rule =
  | { type: "requires"; id: string; option: OptionId; anyOf: OptionId[] }
  | { type: "excludes"; id: string; option: OptionId; excluded: OptionId[] }
  | { type: "overrideLimit"; id: string; ifOption: OptionId; group: GroupId; max: number };

export interface Menu {
  basePrice: Poisha;
  groups: Group[];
  rules: Rule[];
  stock: Record<IngredientId, number>; // starting stock
}

// ---------- Config + validation ----------
export type Selection = Record<OptionId, number>; // optionId -> count

export type ViolationCode =
  | "GROUP_MIN"
  | "GROUP_MAX"
  | "GROUP_STEP"
  | "MAX_DISTINCT"
  | "MAX_PER_OPTION"
  | "REQUIRES"
  | "EXCLUDES";

export interface Violation {
  code: ViolationCode;
  message: string; // human readable
  groupId?: GroupId;
  optionId?: OptionId;
  ruleId?: string;
}

// ---------- Cart + orders ----------
export interface CartLine {
  qty: number; // how many of this whole configuration
  options: Selection;
}

export type PaymentMethod = "card" | "bkash" | "cash";

export interface Order {
  id: string;
  createdAt: string; // ISO with +06:00
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  lines: CartLine[];
  // prices added in Part E when you SAVE orders. Seed has none.
}

export interface SeedFile {
  schemaVersion: number;
  currency: "BDT";
  note: string;
  orders: Order[];
}

// ---------- Pricing result ----------
export interface LinePrice {
  unitPrice: Poisha; // one configuration, after step 1-3
  lineTotal: Poisha; // unitPrice * qty
}

export interface PriceBreakdown {
  lines: LinePrice[];
  subtotal: Poisha;
  discount: Poisha; // the ONE cart discount that applied
  discountLabel: string | null; // "C1", "C2" or coupon code
  discountedSubtotal: Poisha;
  vat: Poisha;
  total: Poisha; // discountedSubtotal + vat
  payable: Poisha; // rounded per brief
}