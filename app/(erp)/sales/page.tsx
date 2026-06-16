'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import {
  ShoppingCart, Plus, Search, Eye, X, Trash2,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Printer
} from 'lucide-react';
import type { Invoice, InvoiceStatus, Customer, Product } from '@/lib/types';

const statusConfig: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  sent: { label: 'Sent', color: 'text-blue-600', bg: 'bg-blue-100' },
  partially_paid: { label: 'Partial', color: 'text-amber-600', bg: 'bg-amber-100' },
  paid: { label: 'Paid', color: 'text-green-600', bg: 'bg-green-100' },
  overdue: { label: 'Overdue', color: 'text-red-600', bg: 'bg-red-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-600', bg: 'bg-gray-100' },
  refunded: { label: 'Refunded', color: 'text-purple-600', bg: 'bg-purple-100' },
};

interface InvoiceWithCustomer extends Omit<Invoice, 'customer'> {
  customer?: { name: string; code: string; phone?: string; address?: string };
}

interface InvoiceItem {
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  subtotal: number;
}

export default function SalesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [stats, setStats] = useState({ total: 0, paid: 0, outstanding: 0, overdue: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceWithCustomer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [invRes, custRes, prodRes] = await Promise.all([
      supabase.from('invoices').select('*, customer:customers(name, code, phone, address)').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ]);
    setInvoices(invRes.data || []);
    setCustomers(custRes.data || []);
    setProducts(prodRes.data || []);

    const allInv = invRes.data || [];
    setStats({
      total: allInv.reduce((s: number, i: any) => s + Number(i.total_amount), 0),
      paid: allInv.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total_amount), 0),
      outstanding: allInv.reduce((s: number, i: any) => s + Number(i.balance_due || 0), 0),
      overdue: allInv.filter((i: any) => i.status === 'overdue').length,
    });
    setLoading(false);
  }

  async function viewInvoiceDetails(invoice: InvoiceWithCustomer) {
    const { data } = await supabase
      .from('invoice_items')
      .select('*, product:products(name, sku, unit)')
      .eq('invoice_id', invoice.id);
    setInvoiceItems(data || []);
    setViewingInvoice(invoice);
  }

  const filtered = invoices.filter(i =>
    (!search || i.invoice_number.toLowerCase().includes(search.toLowerCase()) || i.customer?.name?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || i.status === filterStatus)
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales & Invoices</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track all sales transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/pos" className="flex items-center gap-2 border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <ShoppingCart className="w-4 h-4" />POS
          </Link>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            <Plus className="w-4 h-4" />New Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: formatCurrency(stats.total), icon: TrendingUp, color: 'text-blue-500 bg-blue-50' },
          { label: 'Collected', value: formatCurrency(stats.paid), icon: CheckCircle2, color: 'text-green-500 bg-green-50' },
          { label: 'Outstanding', value: formatCurrency(stats.outstanding), icon: Clock, color: 'text-amber-500 bg-amber-50' },
          { label: 'Overdue Invoices', value: stats.overdue, icon: AlertCircle, color: 'text-red-500 bg-red-50' },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.color}`}><s.icon className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold text-foreground">{s.value}</p></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-8 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All Status</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Invoice #</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Due Date</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Amount</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Paid</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Balance</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">No invoices found</td></tr>
              ) : filtered.map((inv) => {
                const cfg = statusConfig[inv.status as InvoiceStatus] || statusConfig.draft;
                return (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-blue-600">{inv.invoice_number}</span></td>
                    <td className="px-4 py-3 text-sm text-foreground">{inv.customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-600 font-semibold">{formatCurrency(inv.amount_paid)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-600">{formatCurrency(inv.balance_due || (inv.total_amount - inv.amount_paid))}</td>
                    <td className="px-4 py-3"><span className={`badge-status ${cfg.bg} ${cfg.color}`}>{cfg.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => viewInvoiceDetails(inv)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition ml-auto">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">{filtered.length} invoices</p>
        </div>
      </div>

      {showCreateModal && (
        <CreateInvoiceModal
          customers={customers}
          products={products}
          onClose={() => setShowCreateModal(false)}
          onSaved={loadData}
        />
      )}

      {viewingInvoice && (
        <ViewInvoiceModal
          invoice={viewingInvoice}
          items={invoiceItems}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div>
  );
}

function CreateInvoiceModal({ customers, products, onClose, onSaved }: {
  customers: Customer[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });
  const [items, setItems] = useState<{ product_id: string; quantity: number; unit_price: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addItem() {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0 }]);
  }

  function updateItem(index: number, field: string, value: any) {
    const updated = [...items];
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      updated[index] = { product_id: value, quantity: 1, unit_price: product?.sale_price || 0 };
    } else {
      (updated[index] as any)[field] = value;
    }
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id);
    return sum + (item.quantity * (item.unit_price || product?.sale_price || 0));
  }, 0);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError('Please select a customer'); return; }
    if (items.length === 0) { setError('Please add at least one item'); return; }

    setSaving(true);
    setError('');

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const totalAmount = subtotal;

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_id: form.customer_id,
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        subtotal,
        total_amount: totalAmount,
        amount_paid: 0,
        balance_due: totalAmount,
        status: 'draft',
        is_pos: false,
        notes: form.notes || null,
      })
      .select()
      .single();

    if (invError) { setError(invError.message); setSaving(false); return; }

    const invoiceItems = items.map(item => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: 0,
      tax_rate: 0,
      subtotal: item.quantity * item.unit_price,
    }));

    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
    if (itemsError) { setError(itemsError.message); setSaving(false); return; }

    toast({ title: 'Success', description: 'Invoice created successfully' });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold">Create New Invoice</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Customer *</label>
              <select required value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Invoice Date</label>
              <input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium">Line Items</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Product</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-20">Qty</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-28">Price</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-28">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">No items added. Click "Add Item" to add products.</td></tr>
                  ) : items.map((item, index) => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <select value={item.product_id} onChange={e => updateItem(index, 'product_id', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm focus:outline-none">
                            <option value="">Select product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold">{formatCurrency(item.quantity * item.unit_price)}</td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end bg-muted/30 rounded-lg p-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(subtotal)}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Additional notes..." />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewInvoiceModal({ invoice, items, onClose }: { invoice: InvoiceWithCustomer; items: any[]; onClose: () => void }) {
  const cfg = statusConfig[invoice.status as InvoiceStatus] || statusConfig.draft;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white">
          <h2 className="text-base font-bold">Invoice {invoice.invoice_number}</h2>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition">
              <Printer className="w-4 h-4" />Print
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-semibold text-foreground">{invoice.customer?.name || '-'}</p>
              <p className="text-sm text-muted-foreground">{invoice.customer?.phone || '-'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Status</p>
              <span className={`badge-status ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 py-3 border-y border-border">
            <div>
              <p className="text-xs text-muted-foreground">Invoice Date</p>
              <p className="text-sm font-medium">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>
              <p className="text-sm font-medium">{invoice.due_date ? formatDate(invoice.due_date) : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amount Paid</p>
              <p className="text-sm font-medium text-green-600">{formatCurrency(invoice.amount_paid)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Items</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Product</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Qty</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Price</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">No items</td></tr>
                  ) : items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-sm">{item.product?.name || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 text-sm text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end bg-muted/30 rounded-lg p-4">
            <div className="w-48 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-green-600">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                <span>Balance Due</span>
                <span className="text-red-600">{formatCurrency(invoice.balance_due || invoice.total_amount - invoice.amount_paid)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
