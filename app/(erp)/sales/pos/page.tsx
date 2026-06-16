'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, CheckCircle2, X, Receipt } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  quantity: number;
  image_url?: string;
}

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [orderComplete, setOrderComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState('');

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*, inventory_items(quantity_on_hand)').eq('is_active', true).limit(100);
    setProducts(data || []);
    setLoading(false);
  }

  async function loadCustomers() {
    const { data } = await supabase.from('customers').select('id, name, code').eq('is_active', true).limit(100);
    setCustomers(data || []);
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(product: any) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, name: product.name, sku: product.sku, sale_price: product.sale_price, quantity: 1, image_url: product.image_url }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  const subtotal = cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  async function processOrder() {
    if (cart.length === 0) return;
    setProcessing(true);

    try {
      const invoiceNumber = `POS-${Date.now().toString().slice(-8)}`;
      setLastInvoiceNumber(invoiceNumber);

      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: selectedCustomer || null,
          invoice_date: new Date().toISOString().split('T')[0],
          subtotal: subtotal,
          discount_amount: discountAmount,
          tax_amount: 0,
          total_amount: total,
          amount_paid: total,
          balance_due: 0,
          status: 'paid',
          is_pos: true,
        })
        .select()
        .single();

      if (invError) throw invError;

      const invoiceItems = cart.map(item => ({
        invoice_id: invoice.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.sale_price,
        discount_percent: discount,
        tax_rate: 0,
        subtotal: item.quantity * item.sale_price,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
      if (itemsError) throw itemsError;

      setCart([]);
      setDiscount(0);
      setSelectedCustomer('');
      setOrderComplete(true);
      toast({ title: 'Success', description: `Order ${invoiceNumber} completed successfully` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to process order', variant: 'destructive' });
    }

    setProcessing(false);
    setTimeout(() => setOrderComplete(false), 4000);
  }

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-600 bg-green-50 border-green-200' },
    { id: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'bkash', label: 'bKash', icon: Smartphone, color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { id: 'nagad', label: 'Nagad', icon: Smartphone, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  ];

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 animate-fade-in">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name or SKU..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            />
          </div>
          <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none min-w-[180px]">
            <option value="">Walk-in Customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start pb-4">
          {loading ? Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-3 animate-pulse"><div className="h-20 bg-muted rounded-lg mb-2" /><div className="h-3 bg-muted rounded mb-1" /><div className="h-3 bg-muted rounded w-2/3" /></div>
          )) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">No products found</div>
          ) : filteredProducts.map(p => {
            const stock = p.inventory_items?.reduce((s: number, i: any) => s + Number(i.quantity_on_hand), 0) || 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={stock === 0}
                className="bg-white rounded-xl border border-border p-3 text-left hover:border-blue-400 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-full h-20 bg-muted rounded-lg overflow-hidden mb-2">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl">?</div>}
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight mb-0.5 line-clamp-2">{p.name}</p>
                <p className="text-[10px] text-muted-foreground mb-1">{p.sku}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-blue-600">{formatCurrency(p.sale_price)}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${stock > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{stock}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-80 flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden relative">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Cart ({cart.length})</h2>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Clear</button>}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center py-12">
              <div>
                <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground">Click products to add</p>
              </div>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded-xl p-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-base">?</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(item.sale_price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center hover:bg-muted transition"><Minus className="w-2.5 h-2.5" /></button>
                <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition"><Plus className="w-2.5 h-2.5" /></button>
              </div>
              <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-red-500 transition"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="p-3 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">Discount %</span>
              <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-16 border border-border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-red-500"><span>Discount ({discount}%)</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {paymentMethods.map(m => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition ${paymentMethod === m.id ? m.color + ' border-current' : 'border-border text-muted-foreground hover:border-blue-200'}`}>
                  <m.icon className="w-3 h-3" />{m.label}
                </button>
              ))}
            </div>

            <button
              onClick={processOrder}
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 text-sm"
            >
              {processing ? 'Processing...' : `Charge ${formatCurrency(total)}`}
            </button>
          </div>
        )}

        {orderComplete && (
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center rounded-2xl z-10">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-3" />
            <h3 className="font-bold text-lg text-foreground">Order Complete!</h3>
            <p className="text-sm text-muted-foreground mt-1">{lastInvoiceNumber}</p>
            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => setOrderComplete(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">New Order</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
