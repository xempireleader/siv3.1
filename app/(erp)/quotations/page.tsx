'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Eye, Send, X, Trash2, FileText, ArrowRight } from 'lucide-react';
import type { Quotation, QuotationStatus, Customer, Product } from '@/lib/types';

const statusConfig: Record<QuotationStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  sent: { label: 'Sent', color: 'text-blue-600', bg: 'bg-blue-100' },
  viewed: { label: 'Viewed', color: 'text-purple-600', bg: 'bg-purple-100' },
  accepted: { label: 'Accepted', color: 'text-green-600', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100' },
  expired: { label: 'Expired', color: 'text-orange-600', bg: 'bg-orange-100' },
  converted: { label: 'Converted', color: 'text-teal-600', bg: 'bg-teal-100' },
};

interface QuotationWithCustomer extends Omit<Quotation, 'customer'> {
  customer?: { name: string; code: string };
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState<QuotationWithCustomer | null>(null);
  const [quotationItems, setQuotationItems] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [quoteRes, custRes, prodRes] = await Promise.all([
      supabase.from('quotations').select('*, customer:customers(name, code)').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ]);
    setQuotations(quoteRes.data || []);
    setCustomers(custRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
  }

  async function viewQuotationDetails(quotation: QuotationWithCustomer) {
    const { data } = await supabase
      .from('quotation_items')
      .select('*, product:products(name, sku, unit)')
      .eq('quotation_id', quotation.id);
    setQuotationItems(data || []);
    setViewingQuotation(quotation);
  }

  async function sendQuotation(quotation: QuotationWithCustomer) {
    const { error } = await supabase
      .from('quotations')
      .update({ status: 'sent' })
      .eq('id', quotation.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Quotation marked as sent' });
      loadData();
    }
  }

  async function convertToInvoice(quotation: QuotationWithCustomer) {
    if (quotation.status === 'converted') {
      toast({ title: 'Error', description: 'Quotation already converted', variant: 'destructive' });
      return;
    }

    const { data: items } = await supabase
      .from('quotation_items')
      .select('*, product:products(name, sku, unit)')
      .eq('quotation_id', quotation.id);

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_id: quotation.customer_id,
        quotation_id: quotation.id,
        invoice_date: new Date().toISOString().split('T')[0],
        subtotal: quotation.subtotal,
        discount_amount: quotation.discount_amount,
        tax_amount: quotation.tax_amount,
        total_amount: quotation.total_amount,
        amount_paid: 0,
        balance_due: quotation.total_amount,
        status: 'draft',
        is_pos: false,
      })
      .select()
      .single();

    if (invError) {
      toast({ title: 'Error', description: invError.message, variant: 'destructive' });
      return;
    }

    if (items && items.length > 0) {
      const invoiceItems = items.map((item: any) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        tax_rate: item.tax_rate || 0,
        subtotal: item.subtotal,
      }));

      await supabase.from('invoice_items').insert(invoiceItems);
    }

    await supabase.from('quotations').update({ status: 'converted' }).eq('id', quotation.id);

    toast({ title: 'Success', description: `Invoice ${invoiceNumber} created from quotation` });
    loadData();
    setViewingQuotation(null);
  }

  const filtered = quotations.filter(q =>
    (!search || q.quote_number.toLowerCase().includes(search.toLowerCase()) || q.customer?.name?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || q.status === filterStatus)
  );

  const stats = {
    total: quotations.length,
    sent: quotations.filter(q => q.status === 'sent' || q.status === 'viewed').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
    totalValue: quotations.filter(q => q.status !== 'expired' && q.status !== 'rejected' && q.status !== 'converted').reduce((s, q) => s + Number(q.total_amount), 0),
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create and manage price quotations</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus className="w-4 h-4" />New Quotation
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Quotes', value: stats.total },
          { label: 'Awaiting Response', value: stats.sent },
          { label: 'Accepted', value: stats.accepted },
          { label: 'Pipeline Value', value: formatCurrency(stats.totalValue) },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..." className="w-full pl-8 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
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
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Quote #</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Issue Date</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Expiry</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No quotations found</td></tr>
              ) : filtered.map((q) => {
                const cfg = statusConfig[q.status as QuotationStatus] || statusConfig.draft;
                return (
                  <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-blue-600">{q.quote_number}</span></td>
                    <td className="px-4 py-3 text-sm text-foreground">{q.customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(q.issue_date)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{q.expiry_date ? formatDate(q.expiry_date) : '-'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatCurrency(q.total_amount)}</td>
                    <td className="px-4 py-3"><span className={`badge-status ${cfg.bg} ${cfg.color}`}>{cfg.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => viewQuotationDetails(q)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition"><Eye className="w-3.5 h-3.5" /></button>
                        {q.status === 'draft' && (
                          <button onClick={() => sendQuotation(q)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition"><Send className="w-3.5 h-3.5" /></button>
                        )}
                        {q.status !== 'converted' && q.status !== 'rejected' && q.status !== 'expired' && (
                          <button onClick={() => convertToInvoice(q)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-purple-50 text-muted-foreground hover:text-purple-600 transition" title="Convert to Invoice"><ArrowRight className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateQuotationModal
          customers={customers}
          products={products}
          onClose={() => setShowCreateModal(false)}
          onSaved={loadData}
        />
      )}

      {viewingQuotation && (
        <ViewQuotationModal
          quotation={viewingQuotation}
          items={quotationItems}
          onClose={() => setViewingQuotation(null)}
          onConvert={() => convertToInvoice(viewingQuotation)}
        />
      )}
    </div>
  );
}

function CreateQuotationModal({ customers, products, onClose, onSaved }: {
  customers: Customer[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    notes: '',
  });
  const [items, setItems] = useState<{ product_id: string; quantity: number; unit_price: number; discount_percent: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addItem() {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
  }

  function updateItem(index: number, field: string, value: any) {
    const updated = [...items];
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      updated[index] = { product_id: value, quantity: 1, unit_price: product?.sale_price || 0, discount_percent: 0 };
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
    const price = item.unit_price || product?.sale_price || 0;
    const discount = (price * item.quantity * item.discount_percent) / 100;
    return sum + (item.quantity * price - discount);
  }, 0);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError('Please select a customer'); return; }
    if (items.length === 0) { setError('Please add at least one item'); return; }

    setSaving(true);
    setError('');

    const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;

    const { data: quote, error: quoteError } = await supabase
      .from('quotations')
      .insert({
        quote_number: quoteNumber,
        customer_id: form.customer_id,
        issue_date: form.issue_date,
        expiry_date: form.expiry_date || null,
        subtotal,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: subtotal,
        status: 'draft',
        notes: form.notes || null,
      })
      .select()
      .single();

    if (quoteError) { setError(quoteError.message); setSaving(false); return; }

    const quoteItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      const price = item.unit_price || product?.sale_price || 0;
      const discount = (price * item.quantity * item.discount_percent) / 100;
      return {
        quotation_id: quote.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: price,
        discount_percent: item.discount_percent,
        tax_rate: 0,
        subtotal: item.quantity * price - discount,
      };
    });

    const { error: itemsError } = await supabase.from('quotation_items').insert(quoteItems);
    if (itemsError) { setError(itemsError.message); setSaving(false); return; }

    toast({ title: 'Success', description: 'Quotation created successfully' });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold">Create Quotation</h2>
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
              <label className="block text-xs font-medium mb-1">Issue Date</label>
              <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
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
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-20">Disc%</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-28">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">No items added</td></tr>
                  ) : items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <select value={item.product_id} onChange={e => updateItem(index, 'product_id', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm focus:outline-none">
                          <option value="">Select product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" max="100" value={item.discount_percent} onChange={e => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold">{formatCurrency(item.quantity * item.unit_price * (1 - item.discount_percent / 100))}</td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end bg-muted/30 rounded-lg p-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(subtotal)}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewQuotationModal({ quotation, items, onClose, onConvert }: {
  quotation: QuotationWithCustomer;
  items: any[];
  onClose: () => void;
  onConvert: () => void;
}) {
  const cfg = statusConfig[quotation.status as QuotationStatus] || statusConfig.draft;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white">
          <h2 className="text-base font-bold">Quotation {quotation.quote_number}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-semibold text-foreground">{quotation.customer?.name || '-'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Status</p>
              <span className={`badge-status ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-3 border-y border-border">
            <div>
              <p className="text-xs text-muted-foreground">Issue Date</p>
              <p className="text-sm font-medium">{formatDate(quotation.issue_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm font-medium">{quotation.expiry_date ? formatDate(quotation.expiry_date) : '-'}</p>
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
            <div className="w-48">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(quotation.total_amount)}</span>
              </div>
            </div>
          </div>

          {quotation.status !== 'converted' && quotation.status !== 'rejected' && quotation.status !== 'expired' && (
            <button onClick={onConvert} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition">
              <FileText className="w-4 h-4" />Convert to Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
