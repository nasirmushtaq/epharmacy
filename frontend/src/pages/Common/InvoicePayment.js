import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import {
  Receipt,
  Payment,
  Download,
  Print,
  Share,
  CheckCircle,
  Pending,
  Error,
  CreditCard,
  AccountBalance,
  LocalAtm,
  QrCode,
  RefreshOutlined
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import moment from 'moment';

const InvoicePayment = () => {
  const { orderId } = useParams();
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [refundDialog, setRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  const queryClient = useQueryClient();

  // Fetch order details
  const { data: order, isLoading } = useQuery(
    ['order', orderId],
    async () => {
      const response = await axios.get(`/api/orders/${orderId}`);
      return response.data.data;
    },
    {
      enabled: !!orderId
    }
  );

  // Fetch payment history
  const { data: payments } = useQuery(
    ['payments', orderId],
    async () => {
      const response = await axios.get(`/api/orders/${orderId}/payments`);
      return response.data.data;
    },
    {
      enabled: !!orderId
    }
  );

  // Process payment mutation
  const processPaymentMutation = useMutation(
    async (paymentData) => {
      const response = await axios.post(`/api/orders/${orderId}/payment`, paymentData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['order', orderId]);
        queryClient.invalidateQueries(['payments', orderId]);
        toast.success('Payment processed successfully!');
        setPaymentDialog(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Payment processing failed');
      }
    }
  );

  // Process refund mutation
  const processRefundMutation = useMutation(
    async (refundData) => {
      const response = await axios.post(`/api/orders/${orderId}/refund`, refundData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['order', orderId]);
        queryClient.invalidateQueries(['payments', orderId]);
        toast.success('Refund processed successfully!');
        setRefundDialog(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Refund processing failed');
      }
    }
  );

  // Generate invoice mutation
  const generateInvoiceMutation = useMutation(
    async () => {
      const response = await axios.get(`/api/orders/${orderId}/invoice`, {
        responseType: 'blob'
      });
      
      // Create blob URL and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${order?.orderNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Invoice downloaded successfully!');
      },
      onError: (error) => {
        toast.error('Failed to generate invoice');
      }
    }
  );

  const handlePayment = () => {
    if (!paymentMethod || !paymentAmount) {
      toast.warning('Please fill all payment details');
      return;
    }

    processPaymentMutation.mutate({
      method: paymentMethod,
      amount: parseFloat(paymentAmount),
      transactionId: `TXN${Date.now()}`
    });
  };

  const handleRefund = () => {
    if (!refundReason) {
      toast.warning('Please provide refund reason');
      return;
    }

    processRefundMutation.mutate({
      reason: refundReason,
      amount: order?.totalAmount
    });
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPaymentStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'pending':
        return <Pending />;
      case 'failed':
        return <Error />;
      default:
        return <Pending />;
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Order not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Invoice & Payment
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => generateInvoiceMutation.mutate()}
            disabled={generateInvoiceMutation.isLoading}
          >
            {generateInvoiceMutation.isLoading ? 'Generating...' : 'Download Invoice'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Print />}
            onClick={() => window.print()}
          >
            Print
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Invoice Details */}
        <Grid item xs={12} md={8}>
          <Card elevation={2}>
            <CardContent>
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="h5" gutterBottom>
                    E-PHARMACY
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    123 Pharmacy Street<br />
                    Healthcare City, HC 12345<br />
                    Phone: +91 98765 43210
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" gutterBottom>
                    INVOICE
                  </Typography>
                  <Typography variant="body2">
                    <strong>Invoice #:</strong> INV-{order.orderNumber}<br />
                    <strong>Order #:</strong> {order.orderNumber}<br />
                    <strong>Date:</strong> {moment(order.createdAt).format('DD/MM/YYYY')}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Customer Details */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Bill To:
                  </Typography>
                  <Typography variant="body2">
                    {order.customer?.firstName} {order.customer?.lastName}<br />
                    {order.deliveryAddress?.address}<br />
                    {order.deliveryAddress?.city}, {order.deliveryAddress?.state}<br />
                    {order.deliveryAddress?.pincode}<br />
                    Phone: {order.deliveryAddress?.phone}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Order Details:
                  </Typography>
                  <Typography variant="body2">
                    <strong>Status:</strong> 
                    <Chip 
                      label={order.status} 
                      color={order.status === 'delivered' ? 'success' : 'primary'} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                    <br />
                    <strong>Payment Method:</strong> {order.paymentMethod?.toUpperCase()}<br />
                    <strong>Payment Status:</strong> 
                    <Chip 
                      label={order.paymentStatus} 
                      color={getPaymentStatusColor(order.paymentStatus)} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Grid>
              </Grid>

              {/* Items Table */}
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Item</strong></TableCell>
                      <TableCell align="center"><strong>Quantity</strong></TableCell>
                      <TableCell align="right"><strong>Unit Price</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {item.medicine?.name || item.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.medicine?.brand} | {item.medicine?.strength} {item.medicine?.unit}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">₹{item.price?.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{(item.quantity * item.price)?.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totals */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ minWidth: 300 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Subtotal:</Typography>
                    <Typography>₹{order.subtotal?.toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Delivery Charges:</Typography>
                    <Typography>₹{order.deliveryCharges?.toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Tax:</Typography>
                    <Typography>₹{order.tax?.toFixed(2)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6"><strong>Total Amount:</strong></Typography>
                    <Typography variant="h6" color="primary">
                      <strong>₹{order.totalAmount?.toFixed(2)}</strong>
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Panel */}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Status
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {getPaymentStatusIcon(order.paymentStatus)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {order.paymentStatus?.toUpperCase()}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Amount: ₹{order.totalAmount?.toFixed(2)}
              </Typography>

              {order.paymentStatus !== 'completed' && (
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Payment />}
                  onClick={() => setPaymentDialog(true)}
                  sx={{ mb: 2 }}
                >
                  Process Payment
                </Button>
              )}

              {order.paymentStatus === 'completed' && order.status !== 'delivered' && (
                <Button
                  variant="outlined"
                  fullWidth
                  color="error"
                  startIcon={<RefreshOutlined />}
                  onClick={() => setRefundDialog(true)}
                  sx={{ mb: 2 }}
                >
                  Request Refund
                </Button>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Payment Methods Available:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <LocalAtm fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Cash on Delivery" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CreditCard fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Credit/Debit Card" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AccountBalance fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Net Banking" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <QrCode fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="UPI Payment" />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Payment History */}
          {payments && payments.length > 0 && (
            <Card elevation={2} sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Payment History
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <List>
                  {payments.map((payment, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={`₹${payment.amount} - ${payment.method?.toUpperCase()}`}
                        secondary={
                          <Box>
                            <Typography variant="caption">
                              {moment(payment.createdAt).format('DD/MM/YYYY HH:mm')}
                            </Typography>
                            <br />
                            <Chip
                              label={payment.status}
                              color={getPaymentStatusColor(payment.status)}
                              size="small"
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Process Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <MenuItem value="cash">Cash on Delivery</MenuItem>
                  <MenuItem value="card">Credit/Debit Card</MenuItem>
                  <MenuItem value="netbanking">Net Banking</MenuItem>
                  <MenuItem value="upi">UPI Payment</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                InputProps={{
                  startAdornment: '₹'
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button
            onClick={handlePayment}
            variant="contained"
            disabled={processPaymentMutation.isLoading}
          >
            {processPaymentMutation.isLoading ? 'Processing...' : 'Process Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundDialog} onClose={() => setRefundDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Refund</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Refund Reason"
            multiline
            rows={4}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Please explain why you want to refund this order..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundDialog(false)}>Cancel</Button>
          <Button
            onClick={handleRefund}
            variant="contained"
            color="error"
            disabled={processRefundMutation.isLoading}
          >
            {processRefundMutation.isLoading ? 'Processing...' : 'Request Refund'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default InvoicePayment; 