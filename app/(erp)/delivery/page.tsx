'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, MapPin, Clock, CheckCircle2, XCircle, Package, Truck, X, Edit } from 'lucide-react';
import type { Delivery, DeliveryStatus, Customer, Invoice } from '@/lib/types';

const statusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
  assigned: { label: 'Assigned', color: 'text-blue-600', bg: 'bg-blue-100', icon: Package },
  in_transit: { label: 'In Transit', color: 'text-orange-600', bg: 'bg-orange-100', icon: Truck },
  delivered: { label: 'Delivered', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
  returned: { label: 'Returned', color: 'text-purple-600', bg: 'bg-purple-100', icon: Package },
};

interface DeliveryWithCustomer extends Omit<Delivery, 'customer'> {
  customer?: { name: string; phone: string; address: string };
}

export default function DeliveryPage() {
  const [deliveries, setDeliveries] = useState<DeliveryWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryWithCustomer | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [delRes, custRes] = await Promise.all([
      supabase.from('deliveries').select('*, customer:customers(name, phone, address)').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
    ]);
    setDeliveries(delRes.data || []);
    setCustomers(custRes.data || []);
    setLoading(false);
  }

  async function updateStatus(deliveryId: string, newStatus: DeliveryStatus) {
    const updateData: any = { status: newStatus };
    if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('deliveries')
      .update(updateData)
      .eq('id', deliveryId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Delivery status updated to ${statusConfig[newStatus].label}` });
      loadData();
    }
  }

  const filtered = deliveries.filter(d =>
    (!search || d.delivery_number.toLowerCase().includes(search.toLowerCase()) || d.customer?.name?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || d.status === filterStatus)
  );

  const stats = {
    pending: deliveries.filter(d => d.status === 'pending').length,
    inTransit: deliveries.filter(d => d.status === 'in_transit').length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    failed: deliveries.filter(d => d.status === 'failed').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track and manage deliveries</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus className="w-4 h-4" />Create Delivery
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-gray-500', bg: 'bg-gray-50', icon: Clock },
          { label: 'In Transit', value: stats.inTransit, color: 'text-orange-500', bg: 'bg-orange-50', icon: Truck },
          { label: 'Delivered', value: stats.delivered, color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 },
          { label: 'Failed', value: stats.failed, color: 'text-red-500', bg: 'bg-red-50', icon: XCircle },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-full flex items-center justify-center`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deliveries..." className="w-full pl-8 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
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
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Delivery #</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Address</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Delivery Date</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No deliveries found</td></tr>
              ) : filtered.map((d) => {
                const cfg = statusConfig[d.status as DeliveryStatus] || statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-blue-600">{d.delivery_number}</span></td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{d.customer?.name || '-'}</p>
                        {d.customer?.phone && <p className="text-xs text-muted-foreground">{d.customer.phone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-foreground">{d.delivery_address || '-'}</p>
                          {d.delivery_city && <p className="text-xs text-muted-foreground">{d.delivery_city}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{d.delivery_date ? formatDate(d.delivery_date) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingDelivery(d)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition"><Edit className="w-3.5 h-3.5" /></button>
                        <select
                          value={d.status}
                          onChange={e => updateStatus(d.id, e.target.value as DeliveryStatus)}
                          className="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border"><p className="text-xs text-muted-foreground">{filtered.length} deliveries</p></div>
      </div>

      {showCreateModal && (
        <DeliveryModal
          customers={customers}
          onClose={() => setShowCreateModal(false)}
          onSaved={loadData}
        />
      )}
      {editingDelivery && (
        <DeliveryModal
          customers={customers}
          delivery={editingDelivery}
          onClose={() => setEditingDelivery(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

function DeliveryModal({ customers, delivery, onClose, onSaved }: {
  customers: Customer[];
  delivery?: DeliveryWithCustomer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!delivery;
  const [form, setForm] = useState({
    customer_id: delivery?.customer_id || '',
    delivery_date: delivery?.delivery_date || '',
    delivery_address: delivery?.delivery_address || '',
    delivery_city: delivery?.delivery_city || '',
    vehicle_number: delivery?.vehicle_number || '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const deliveryNumber = delivery?.delivery_number || `DLV-${Date.now().toString().slice(-6)}`;
    const data = {
      delivery_number: deliveryNumber,
      customer_id: form.customer_id || null,
      delivery_date: form.delivery_date || null,
      delivery_address: form.delivery_address || null,
      delivery_city: form.delivery_city || null,
      vehicle_number: form.vehicle_number || null,
      status: (isEdit ? delivery.status : 'pending') as 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'returned',
    };

    const { error } = isEdit
      ? await supabase.from('deliveries').update(data).eq('id', delivery!.id)
      : await supabase.from('deliveries').insert(data);

    if (error) { setError(error.message); setSaving(false); return; }

    toast({ title: 'Success', description: isEdit ? 'Delivery updated successfully' : 'Delivery created successfully' });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white">
          <h2 className="text-base font-bold">{isEdit ? 'Edit Delivery' : 'Create Delivery'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-xs font-medium mb-1">Customer</label>
            <select required value={form.customer_id} onChange={e => {
              const customer = customers.find(c => c.id === e.target.value);
              setForm({
                ...form,
                customer_id: e.target.value,
                delivery_address: customer?.address || form.delivery_address,
                delivery_city: customer?.city || form.delivery_city,
              });
            }} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">Select customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Delivery Date</label>
              <input type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Vehicle Number</label>
              <input value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} placeholder="e.g. DHK-1234" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Delivery Address</label>
            <textarea value={form.delivery_address} onChange={e => setForm({ ...form, delivery_address: e.target.value })} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">City</label>
            <input value={form.delivery_city} onChange={e => setForm({ ...form, delivery_city: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Update Delivery' : 'Create Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
