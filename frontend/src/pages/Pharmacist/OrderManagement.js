import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Avatar,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  Schedule,
  Person,
  LocalShipping,
  LocalPharmacy,
  Assignment,
  Refresh,
  FilterList,
  PlayArrow
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../api/config';

const OrderManagement = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState(false);
  const [updateStatusDialog, setUpdateStatusDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  const queryClient = useQueryClient();

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery(
    ['orders', 'pharmacist', page, rowsPerPage, statusFilter],
    async () => {
      let endpoint = '/api/orders';
      if (statusFilter === 'pending') {
        endpoint = '/api/orders/status/pending';
      }
      
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...(statusFilter !== 'all' && statusFilter !== 'pending' && { status: statusFilter })
      });

      const response = await api.get(`${endpoint}?${params}`);
      return response.data;
    },
    {
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to fetch orders');
      }
    }
  );

  // Fetch available delivery agents
  const { data: agents } = useQuery(
    ['delivery-agents', 'available'],
    async () => {
      const response = await api.get('/api/deliveries/agents/available');
      return response.data.data;
    },
    {
      enabled: assignDialog
    }
  );

  // Fetch order stats
  const { data: stats } = useQuery(
    ['orders', 'stats'],
    async () => {
      const response = await api.get('/api/orders/meta/stats');
      return response.data.data;
    }
  );

  // Update order status mutation
  const updateStatusMutation = useMutation(
        async ({ id, status, notes }) => {
      const response = await api.patch(`/api/orders/${id}/status`,
        { status, notes }
      );
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Order status updated successfully!');
        queryClient.invalidateQueries(['orders']);
        setUpdateStatusDialog(false);
        setSelectedOrder(null);
        setNewStatus('');
        setStatusNotes('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update order status');
      }
    }
  );

  // Assign delivery agent mutation
  const assignDeliveryMutation = useMutation(
    async ({ orderId, agentId }) => {
      const response = await api.post('/api/deliveries/assign', 
        { orderId, agentId }
      );
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Delivery agent assigned successfully!');
        queryClient.invalidateQueries(['orders']);
        setAssignDialog(false);
        setSelectedOrder(null);
        setSelectedAgent('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to assign delivery agent');
      }
    }
  );

  const orders = ordersData?.data || [];
  const totalOrders = ordersData?.total || 0;

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setViewDialog(true);
  };

  const handleUpdateStatus = (order, status) => {
    setSelectedOrder(order);
    setNewStatus(status);
    setUpdateStatusDialog(true);
  };

  const handleAssignDelivery = (order) => {
    setSelectedOrder(order);
    setAssignDialog(true);
  };

  const submitStatusUpdate = () => {
    updateStatusMutation.mutate({
      id: selectedOrder._id,
      status: newStatus,
      notes: statusNotes
    });
  };

  const submitDeliveryAssignment = () => {
    assignDeliveryMutation.mutate({
      orderId: selectedOrder._id,
      agentId: selectedAgent
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      confirmed: 'info',
      processing: 'primary',
      out_for_delivery: 'secondary',
      shipped: 'secondary', // Keep for backward compatibility
      delivered: 'success',
      cancelled: 'error'
    };
    return colors[status] || 'default';
  };

  const getOrderSteps = (status) => {
    const steps = ['Pending', 'Confirmed', 'Processing', 'Out for Delivery', 'Delivered'];
    const statusMap = {
      'pending': 0,
      'confirmed': 1,
      'processing': 2,
      'out_for_delivery': 3,
      'shipped': 3, // Backward compatibility
      'delivered': 4,
      'cancelled': -1
    };
    const currentIndex = statusMap[status] || 0;
    return { steps, currentIndex };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canUpdateStatus = (currentStatus) => {
    const allowedTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered'],
      shipped: ['delivered'], // Backward compatibility
      delivered: [],
      cancelled: []
    };
    return allowedTransitions[currentStatus] || [];
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Order Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Process and manage customer orders
        </Typography>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <Schedule />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="warning.main">
                      {stats.pending || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Orders
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Assignment />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="primary.main">
                      {stats.processing || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Processing
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <LocalShipping />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="secondary.main">
                      {stats.out_for_delivery || stats.shipped || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Out for Delivery
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CheckCircle />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="success.main">
                      {stats.delivered || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Delivered Today
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status Filter"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="pending">Pending Orders</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="all">All Orders</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => refetch()}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                startIcon={<FilterList />}
                onClick={() => toast.info('Advanced filters coming soon!')}
                fullWidth
              >
                Advanced Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card elevation={2}>
        <CardContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Typography>Loading orders...</Typography>
            </Box>
          ) : orders.length === 0 ? (
            <Alert severity="info">
              <Typography variant="h6" gutterBottom>
                No orders found
              </Typography>
              <Typography>
                No orders matching your criteria. Try changing the filter or refresh the page.
              </Typography>
            </Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Order</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order._id} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                              #{order.orderNumber}
                            </Typography>
                            {order.isPrescriptionOrder && (
                              <Chip label="Rx Order" size="small" color="info" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar>
                              <Person />
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2">
                                {order.customer?.firstName} {order.customer?.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {order.customer?.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              <LocalPharmacy fontSize="small" />
                            </Avatar>
                            <Typography variant="body2">
                              {order.items?.length || 0} item(s)
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(order.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={order.status?.toUpperCase()} 
                            color={getStatusColor(order.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2" fontWeight="bold">
                            ₹{order.totalAmount?.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => handleViewOrder(order)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            
                            {canUpdateStatus(order.status).length > 0 && (
                              <Tooltip title="Update Status">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleUpdateStatus(order, '')}
                                >
                                  <PlayArrow />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {order.status === 'confirmed' && (
                              <Tooltip title="Assign Delivery">
                                <IconButton
                                  size="small"
                                  color="secondary"
                                  onClick={() => handleAssignDelivery(order)}
                                >
                                  <LocalShipping />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={totalOrders}
                page={page}
                onPageChange={(event, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* View Order Dialog */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Order Details - #{selectedOrder?.orderNumber}
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Order Progress */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>Order Progress</Typography>
                <Stepper activeStep={getOrderSteps(selectedOrder.status).currentIndex} alternativeLabel>
                  {getOrderSteps(selectedOrder.status).steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Grid>

              {/* Customer Info */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Customer Information</Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography><strong>Name:</strong> {selectedOrder.customer?.firstName} {selectedOrder.customer?.lastName}</Typography>
                  <Typography><strong>Email:</strong> {selectedOrder.customer?.email}</Typography>
                  <Typography><strong>Phone:</strong> {selectedOrder.customer?.phone}</Typography>
                </Box>
              </Grid>

              {/* Delivery Address */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Delivery Address</Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography>{selectedOrder.deliveryAddress?.street}</Typography>
                  <Typography>{selectedOrder.deliveryAddress?.city}, {selectedOrder.deliveryAddress?.state}</Typography>
                  <Typography>{selectedOrder.deliveryAddress?.zipCode}</Typography>
                  <Typography><strong>Phone:</strong> {selectedOrder.deliveryAddress?.phone}</Typography>
                </Box>
              </Grid>

              {/* Order Items */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>Order Items</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Medicine</TableCell>
                        <TableCell align="center">Quantity</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedOrder.items?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="subtitle2">{item.medicine?.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.medicine?.brand}</Typography>
                          </TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell align="right">₹{item.price?.toFixed(2)}</TableCell>
                          <TableCell align="right">₹{item.total?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Order Summary */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{ minWidth: 300 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>Subtotal:</Typography>
                      <Typography>₹{selectedOrder.subtotal?.toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>Delivery:</Typography>
                      <Typography>₹{selectedOrder.deliveryCharges?.toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>Tax:</Typography>
                      <Typography>₹{selectedOrder.tax?.toFixed(2)}</Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="h6">Total:</Typography>
                      <Typography variant="h6" color="primary">₹{selectedOrder.totalAmount?.toFixed(2)}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          {selectedOrder && canUpdateStatus(selectedOrder.status).length > 0 && (
            <Button
              variant="contained"
              onClick={() => {
                setViewDialog(false);
                handleUpdateStatus(selectedOrder, '');
              }}
            >
              Update Status
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusDialog} onClose={() => setUpdateStatusDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Order Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>New Status</InputLabel>
            <Select
              value={newStatus}
              label="New Status"
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {selectedOrder && canUpdateStatus(selectedOrder.status).map((status) => (
                <MenuItem key={status} value={status}>
                  {status === 'out_for_delivery' ? 'Out for Delivery' : status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes (Optional)"
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Add any notes about this status update..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateStatusDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitStatusUpdate}
            disabled={!newStatus}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Delivery Dialog */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Delivery Agent</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Delivery Agent</InputLabel>
            <Select
              value={selectedAgent}
              label="Select Delivery Agent"
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              {agents?.map((agent) => (
                <MenuItem key={agent._id} value={agent._id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      <Person />
                    </Avatar>
                    <Box>
                      <Typography>{agent.firstName} {agent.lastName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {agent.vehicleType} • {agent.phone}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitDeliveryAssignment}
            disabled={!selectedAgent}
          >
            Assign Agent
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrderManagement; 