
export interface ProductPrice {
  retail?: number;
  purchase?: number;
  recommended?: number;
  wholesale_5m?: number;
  wholesale_1m?: number;
  client?: number;
  online?: number;
  ozon?: number;
  note?: string;
}

export interface ProductAttrs {
  thickness_mm?: string | number;
  roll_size_mm?: string;
  pack_area_m2?: number | string;
  pack_volume_m3?: number;
  roll_area_m2?: number | string;
  marking?: string;
  pack_qty?: number;
  density?: string;
  [key: string]: any;
}

export interface Product {
  id: string;
  name: string;
  supplier_id?: string;
  supplier_title?: string;
  brandOrGroup: string;
  unit: string;
  sku?: string;
  image?: string;
  images?: string[];
  description?: string;
  stockQty?: number;
  prices: ProductPrice;
  attrs: ProductAttrs;
  category_id: string;
  inStock: boolean;
}

export interface Category {
  id: string;
  title: string;
  fields: string[];
  items: Product[];
  image?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  comment?: string;
  items: CartItem[];
  total: number;
  createdAt?: string;
  status: 'new' | 'processing' | 'completed' | 'cancelled';
}

export interface AppState {
  categories: Category[];
  cart: CartItem[];
  orders: Order[];
}
