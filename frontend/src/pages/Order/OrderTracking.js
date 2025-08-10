import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar
} from '@mui/material';
import {
  CheckCircle,
  LocalShipping,
  Inventory,
  Payment,
  Schedule,
  Phone,
  Email,
  LocationOn,
  Receipt,
  ArrowBack,
  Download,
  LocalPharmacy,
  Verified
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { toast } from 'react-toastify';
import axios from 'axios';

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  // Fetch order details
  const { data: order, isLoading, error } = useQuery(
    ['order', orderId],
    async () => {
      const response = await axios.get(`/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data.data;
    },
    {
      enabled: !!orderId,
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to fetch order details');
      }
    }
  );

  // Order status steps
  const getOrderSteps = (status) => {
    const allSteps = [
      {
        label: 'Order Placed',
        description: 'Your order has been received and confirmed',
        icon: <CheckCircle />,
        completed: true
      },
      {
        label: 'Payment Confirmed',
        description: 'Payment has been processed successfully',
        icon: <Payment />,
        completed: ['confirmed', 'processing', 'shipped', 'delivered'].includes(status)
      },
      {
        label: 'Processing',
        description: 'Your medicines are being prepared',
        icon: <Inventory />,
        completed: ['processing', 'shipped', 'delivered'].includes(status)
      },
      {
        label: 'Shipped',
        description: 'Your order is on the way',
        icon: <LocalShipping />,
        completed: ['shipped', 'delivered'].includes(status)
      },
      {
        label: 'Delivered',
        description: 'Order delivered successfully',
        icon: <CheckCircle />,
        completed: status === 'delivered'
      }
    ];

    return allSteps;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      confirmed: 'info',
      processing: 'primary',
      shipped: 'secondary',
      delivered: 'success',
      cancelled: 'error'
    };
    return colors[status] || 'default';
  };

  const getDeliveryEstimate = (status, createdAt) => {
    const orderDate = new Date(createdAt);
    const estimatedDays = status === 'shipped' ? 1 : status === 'processing' ? 2 : 3;
    const estimatedDate = new Date(orderDate);
    estimatedDate.setDate(orderDate.getDate() + estimatedDays);
    
    return estimatedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDownloadInvoice = () => {
    // TODO: Implement invoice download
    toast.info('Invoice download feature coming soon!');
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Loading order details...</Typography>
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        }>
          Order not found or you don't have permission to view this order.
        </Alert>
      </Container>
    );
  }

  const steps = getOrderSteps(order.status);
  const activeStep = steps.findIndex(step => !step.completed);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Order Tracking
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Order #{order.orderNumber}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip 
              label={order.status.toUpperCase()} 
              color={getStatusColor(order.status)}
              size="large"
            />
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleDownloadInvoice}
            >
              Download Invoice
            </Button>
          </Box>
        </Box>

        {/* Success Alert */}
        <Alert severity="success" sx={{ mb: 3, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CheckCircle color="success" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" gutterBottom sx={{ color: 'success.main', fontWeight: 'bold' }}>
                🎉 Order Placed Successfully!
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                Order #{order.orderNumber} • Total: ₹{order.totalAmount.toFixed(2)}
              </Typography>
            </Box>
          </Box>
          
          <Typography variant="body1" sx={{ mb: 2 }}>
            Thank you for choosing our pharmacy! Your order has been confirmed and is now being processed.
            {order.isPrescriptionOrder && " Our licensed pharmacist will review your prescription before dispatching your medicines."}
          </Typography>

          <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="action" />
              <Typography variant="body2">
                <strong>Estimated Delivery:</strong> {getDeliveryEstimate(order.status, order.createdAt)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Payment color="action" />
              <Typography variant="body2">
                <strong>Payment:</strong> {order.payment.method === 'cash_on_delivery' ? 'Cash on Delivery' : 'Online Payment'}
              </Typography>
            </Box>
          </Box>
        </Alert>
      </Box>

      <Grid container spacing={4}>
        {/* Order Timeline */}
        <Grid item xs={12} md={8}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule />
                Order Progress
              </Typography>
              
              <Stepper activeStep={activeStep === -1 ? steps.length : activeStep} orientation="vertical">
                {steps.map((step, index) => (
                  <Step key={step.label} completed={step.completed}>
                    <StepLabel icon={step.icon}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {step.label}
                      </Typography>
                    </StepLabel>
                    <StepContent>
                      <Typography color="text.secondary">
                        {step.description}
                      </Typography>
                      {index === 0 && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Placed on {new Date(order.createdAt).toLocaleString()}
                        </Typography>
                      )}
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card elevation={2} sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Items ({order.items.length})
              </Typography>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Medicine</TableCell>
                      <TableCell align="center">Quantity</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              src={item.medicine.images?.[0]?.url}
                              sx={{ width: 50, height: 50 }}
                            >
                              <LocalPharmacy />
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {item.medicine.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {item.medicine.brand}
                              </Typography>
                                                             {(item.medicine.isPrescriptionRequired || item.medicine.prescriptionRequired) && (
                                 <Chip label="Rx Required" size="small" color="info" />
                               )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body1">
                            {item.quantity}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1">
                            ₹{item.price.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="bold">
                            ₹{item.total.toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Summary & Details */}
        <Grid item xs={12} md={4}>
          {/* Delivery Information */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalShipping />
                Delivery Information
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Estimated Delivery
                </Typography>
                <Typography variant="h6" color="success.main">
                  {getDeliveryEstimate(order.status, order.createdAt)}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                <LocationOn color="action" />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Delivery Address
                  </Typography>
                  <Typography variant="body2">
                    {order.deliveryAddress.street}<br />
                    {order.deliveryAddress.city}, {order.deliveryAddress.state}<br />
                    {order.deliveryAddress.zipCode}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone color="action" />
                <Typography variant="body2">
                  {order.deliveryAddress.phone}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Receipt />
                Order Summary
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Subtotal:</Typography>
                <Typography>₹{order.subtotal.toFixed(2)}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Delivery Charges:</Typography>
                <Typography>₹{order.deliveryCharges.toFixed(2)}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Tax:</Typography>
                <Typography>₹{order.tax.toFixed(2)}</Typography>
              </Box>
              
              <Divider sx={{ my: 1 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6" color="primary">
                  ₹{order.totalAmount.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Payment />
                Payment Details
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Payment Method
                </Typography>
                <Typography variant="body1">
                  {order.payment.method === 'cash_on_delivery' ? 'Cash on Delivery' : 'Online Payment'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Payment Status
                </Typography>
                <Chip 
                  label={order.payment.status.toUpperCase()} 
                  color={order.payment.status === 'completed' ? 'success' : 'warning'}
                  size="small"
                />
              </Box>

              {order.isPrescriptionOrder && (
                <Box sx={{ mt: 2 }}>
                  <Alert severity="info" icon={<Verified />}>
                    <Typography variant="body2">
                      This order contains prescription medicines. Our pharmacist will verify your prescription before processing.
                    </Typography>
                  </Alert>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default OrderTracking; 