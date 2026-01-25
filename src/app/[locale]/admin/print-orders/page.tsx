'use client'

import { Box, Check, Clock, Frame, Package, Truck, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface PrintOrder {
  id: string
  order_id: string
  product_type: 'frame' | 'figurine'
  customer_name: string
  customer_phone: string
  customer_address: string
  price_cents: number
  status: string
  notes: string | null
  created_at: string
  confirmed_at: string | null
  shipped_at: string | null
  completed_at: string | null
  spirit_generations: {
    spirit_id: string
    spirit_name: string
    generated_image: string | null
    user_photo: string | null
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Check className="w-3 h-3" /> },
  producing: { label: 'Producing', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Package className="w-3 h-3" /> },
  shipped: { label: 'Shipped', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: <Truck className="w-3 h-3" /> },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Check className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <X className="w-3 h-3" /> },
}

export default function AdminPrintOrdersPage() {
  const [orders, setOrders] = useState<PrintOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null)
  const [updating, setUpdating] = useState(false)

  const fetchOrders = async () => {
    try {
      const url = filterStatus === 'all'
        ? '/api/admin/print-orders'
        : `/api/admin/print-orders?status=${filterStatus}`
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized. Admin access required.')
          return
        }
        throw new Error('Failed to fetch orders')
      }
      const data = await res.json()
      setOrders(data.orders)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [filterStatus])

  const updateOrderStatus = async (id: string, status: string, notes?: string) => {
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/print-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, notes }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      await fetchOrders()
      setSelectedOrder(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-black/50 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/60">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#D4AF37]">Print Orders</h1>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-black/50 border-white/20 text-white">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/20">
              <SelectItem value="all" className="text-white">All</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key} className="text-white">{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {orders.length === 0 ? (
          <Card className="bg-black/50 border-white/10">
            <CardContent className="py-12 text-center">
              <p className="text-white/40">No orders found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
              const ProductIcon = order.product_type === 'frame' ? Frame : Box

              return (
                <Card
                  key={order.id}
                  className="bg-black/50 border-white/10 hover:border-[#D4AF37]/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/30 shrink-0">
                        {order.spirit_generations?.generated_image ? (
                          <img
                            src={order.spirit_generations.generated_image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <ProductIcon className="w-8 h-8" />
                          </div>
                        )}
                      </div>

                      {/* Order Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <ProductIcon className="w-4 h-4 text-[#D4AF37]" />
                              <span className="text-white font-medium">
                                {order.product_type === 'frame' ? 'Photo Frame' : 'Figurine'}
                              </span>
                              <span className="text-[#D4AF37] font-semibold">
                                ฿{(order.price_cents / 100).toFixed(0)}
                              </span>
                            </div>
                            <p className="text-white/60 text-sm">{order.spirit_generations?.spirit_name}</p>
                          </div>
                          <Badge className={`${statusConfig.color} border`}>
                            {statusConfig.icon}
                            <span className="ml-1">{statusConfig.label}</span>
                          </Badge>
                        </div>

                        <div className="mt-2 text-sm text-white/50">
                          <p>{order.customer_name} | {order.customer_phone}</p>
                          <p className="truncate">{order.customer_address}</p>
                        </div>

                        <p className="text-xs text-white/30 mt-2">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="bg-[#1a1a2e] border-[#D4AF37]/20 text-white max-w-lg">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D4AF37]">Order Details</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Product */}
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-black/30">
                    {selectedOrder.spirit_generations?.generated_image && (
                      <img
                        src={selectedOrder.spirit_generations.generated_image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {selectedOrder.product_type === 'frame' ? 'Photo Frame' : 'Figurine'}
                    </p>
                    <p className="text-white/60 text-sm">{selectedOrder.spirit_generations?.spirit_name}</p>
                    <p className="text-[#D4AF37] font-semibold mt-1">
                      ฿{(selectedOrder.price_cents / 100).toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-3 bg-black/30 rounded-lg space-y-1">
                  <p className="text-white/80"><strong>Name:</strong> {selectedOrder.customer_name}</p>
                  <p className="text-white/80"><strong>Phone:</strong> {selectedOrder.customer_phone}</p>
                  <p className="text-white/80"><strong>Address:</strong> {selectedOrder.customer_address}</p>
                </div>

                {/* Status Update */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Update Status</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={selectedOrder.status === key ? 'default' : 'outline'}
                        className={selectedOrder.status === key
                          ? 'bg-[#D4AF37] text-black'
                          : 'border-white/20 text-white/70 hover:bg-white/10'
                        }
                        disabled={updating}
                        onClick={() => updateOrderStatus(selectedOrder.id, key)}
                      >
                        {config.icon}
                        <span className="ml-1">{config.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Notes</label>
                  <Textarea
                    value={selectedOrder.notes || ''}
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, notes: e.target.value })}
                    className="bg-black/30 border-white/20 text-white"
                    placeholder="Add notes..."
                  />
                  <Button
                    size="sm"
                    onClick={() => updateOrderStatus(selectedOrder.id, selectedOrder.status, selectedOrder.notes || '')}
                    disabled={updating}
                    className="bg-white/20 text-white hover:bg-white/30"
                  >
                    Save Notes
                  </Button>
                </div>

                {/* Timestamps */}
                <div className="text-xs text-white/40 space-y-1">
                  <p>Created: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                  {selectedOrder.confirmed_at && <p>Confirmed: {new Date(selectedOrder.confirmed_at).toLocaleString()}</p>}
                  {selectedOrder.shipped_at && <p>Shipped: {new Date(selectedOrder.shipped_at).toLocaleString()}</p>}
                  {selectedOrder.completed_at && <p>Completed: {new Date(selectedOrder.completed_at).toLocaleString()}</p>}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
