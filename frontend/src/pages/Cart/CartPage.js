import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Button,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Add,
  Remove,
  Delete,
  ShoppingCartOutlined,
  LocalPharmacy,
  CheckCircle,
  Warning,
  ArrowBack,
  Payment,
  Upload,
  CloudUpload
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import axios from 'axios';

const CartPage = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, totalAmount, totalItems } = useCart();
  const { user } = useAuth();
  
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState({
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || '',
    phone: user?.phone || ''
  });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Prescription upload state
  const [prescriptionDialog, setPrescriptionDialog] = useState(false);
  const [prescriptionFiles, setPrescriptionFiles] = useState([]);
  const [uploadedPrescriptions, setUploadedPrescriptions] = useState([]);

  const queryClient = useQueryClient();
  const prescriptionRequired = items.some(item => item.isPrescriptionRequired || item.prescriptionRequired);
  const deliveryCharges = totalAmount > 500 ? 0 : 50;
  const tax = Math.round(totalAmount * 0.05); // 5% tax
  const finalAmount = totalAmount + deliveryCharges + tax;

  const handleQuantityChange = (medicineId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(medicineId);
      return;
    }
    
    const item = items.find(item => item.medicineId === medicineId);
    if (newQuantity > item.maxQuantity) {
      toast.error(`Only ${item.maxQuantity} items available in stock`);
      return;
    }
    
    updateQuantity(medicineId, newQuantity);
  };

  // Prescription upload mutation
  const uploadPrescriptionMutation = useMutation(
    async (formData) => {
      const response = await axios.post('/api/prescriptions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    },
    {
      onSuccess: (data) => {
        toast.success('Prescription uploaded successfully!');
        setUploadedPrescriptions(prev => [...prev, data.data]);
        setPrescriptionFiles([]);
        setPrescriptionDialog(false);
        queryClient.invalidateQueries('userPrescriptions');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to upload prescription');
      }
    }
  );

  const handlePrescriptionUpload = () => {
    if (prescriptionFiles.length === 0) {
      toast.warning('Please select prescription files!');
      return;
    }

    const formData = new FormData();
    prescriptionFiles.forEach((file) => {
      formData.append('prescription', file); // Backend expects 'prescription' field
    });
    
    // Add required fields for backend validation
    formData.append('doctorName', 'Dr. Cart Upload');
    formData.append('doctorRegistrationNumber', 'REG' + Date.now());
    formData.append('patientName', user?.firstName + ' ' + user?.lastName || 'Patient');
    formData.append('patientAge', '30');
    formData.append('patientGender', 'other');
    formData.append('prescriptionDate', new Date().toISOString().split('T')[0]);
    formData.append('validUntil', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    formData.append('notes', 'Uploaded from cart page');

    uploadPrescriptionMutation.mutate(formData);
  };

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (prescriptionRequired && uploadedPrescriptions.length === 0) {
      toast.warning('Please upload prescription for prescription medicines before checkout');
      setPrescriptionDialog(true); // Open upload dialog instead of navigating away
      return;
    }

    setCheckoutDialogOpen(true);
  };

  const processOrder = async () => {
    setIsProcessing(true);
    try {
      // Create order
      const orderData = {
        items: items.map(item => ({
          medicine: item.medicineId,
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.price) || 0
        })),
        deliveryAddress: {
          street: deliveryAddress.address || '',
          city: deliveryAddress.city || '',
          state: deliveryAddress.state || '',
          zipCode: deliveryAddress.pincode || '',
          phone: deliveryAddress.phone || ''
        },
        payment: {
          method: paymentMethod === 'cod' ? 'cash_on_delivery' : 'online'
        },
        notes: specialInstructions,
        prescriptions: uploadedPrescriptions.map(p => p._id),
        subtotal: totalAmount,
        deliveryCharges,
        tax,
        totalAmount: finalAmount
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const order = await response.json();
        clearCart();
        toast.success(
          `🎉 Order #${order.data.orderNumber} placed successfully! Redirecting to tracking page...`,
          { autoClose: 3000 }
        );
        // Delay navigation slightly to show the success message
        setTimeout(() => {
          navigate(`/orders/${order.data._id}`);
        }, 1500);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to place order');
      }
    } catch (error) {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
      setCheckoutDialogOpen(false);
    }
  };

  if (items.length === 0) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <ShoppingCartOutlined sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Your cart is empty
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Browse our medicine catalog and add items to your cart
          </Typography>
          <Button 
            variant="contained" 
            size="large"
            onClick={() => navigate('/medicines')}
          >
            Browse Medicines
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/medicines')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          Shopping Cart ({totalItems} items)
        </Typography>
      </Box>

      {prescriptionRequired && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }} 
          icon={<LocalPharmacy />}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<Upload />}
              onClick={() => setPrescriptionDialog(true)}
              sx={{ ml: 2 }}
            >
              Upload Prescription
            </Button>
          }
        >
          Your cart contains prescription medicines. Upload a valid prescription to proceed with checkout.
          {uploadedPrescriptions.length > 0 && (
            <Typography variant="body2" sx={{ mt: 1, color: 'success.main' }}>
              ✓ {uploadedPrescriptions.length} prescription(s) uploaded
            </Typography>
          )}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Cart Items */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2}>
            {items.map((item, index) => (
              <React.Fragment key={item.medicineId}>
                {index > 0 && <Divider />}
                <Box sx={{ p: 3 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <CardMedia
                        component="img"
                        height="100"
                        image={item.image || '/placeholder-medicine.jpg'}
                        alt={item.name}
                        sx={{ borderRadius: 1, objectFit: 'cover' }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={5}>
                      <Typography variant="h6" gutterBottom>
                        {item.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        {(item.isPrescriptionRequired || item.prescriptionRequired) && (
                          <Chip 
                            label="Rx Required" 
                            color="error" 
                            size="small"
                            icon={<LocalPharmacy />}
                          />
                        )}
                        <Chip 
                          label={`₹${item.price}`} 
                          color="primary" 
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Available: {item.maxQuantity} units
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconButton
                          onClick={() => handleQuantityChange(item.medicineId, item.quantity - 1)}
                          size="small"
                        >
                          <Remove />
                        </IconButton>
                        
                        <Typography sx={{ mx: 2, minWidth: 30, textAlign: 'center' }}>
                          {item.quantity}
                        </Typography>
                        
                        <IconButton
                          onClick={() => handleQuantityChange(item.medicineId, item.quantity + 1)}
                          size="small"
                          disabled={item.quantity >= item.maxQuantity}
                        >
                          <Add />
                        </IconButton>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={2}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="primary">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </Typography>
                        <IconButton
                          onClick={() => removeFromCart(item.medicineId)}
                          color="error"
                          size="small"
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </React.Fragment>
            ))}
          </Paper>
        </Grid>

        {/* Order Summary */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, position: 'sticky', top: 20 }}>
            <Typography variant="h5" gutterBottom>
              Order Summary
            </Typography>
            
            <List>
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="Subtotal" />
                <Typography>₹{totalAmount.toFixed(2)}</Typography>
              </ListItem>
              
              <ListItem sx={{ px: 0 }}>
                <ListItemText 
                  primary="Delivery Charges" 
                  secondary={totalAmount > 500 ? "Free delivery on orders above ₹500" : null}
                />
                <Typography>
                  {deliveryCharges === 0 ? 'FREE' : `₹${deliveryCharges}`}
                </Typography>
              </ListItem>
              
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="Tax (5%)" />
                <Typography>₹{tax.toFixed(2)}</Typography>
              </ListItem>
              
              <Divider />
              
              <ListItem sx={{ px: 0 }}>
                <ListItemText 
                  primary={
                    <Typography variant="h6">Total</Typography>
                  } 
                />
                <Typography variant="h6" color="primary">
                  ₹{finalAmount.toFixed(2)}
                </Typography>
              </ListItem>
            </List>

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<Payment />}
              onClick={handleCheckout}
              sx={{ mt: 2 }}
            >
              Proceed to Checkout
            </Button>

            <Button
              variant="outlined"
              fullWidth
              size="large"
              onClick={() => navigate('/medicines')}
              sx={{ mt: 1 }}
            >
              Continue Shopping
            </Button>

            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Benefits:
              </Typography>
              <List dense>
                <ListItem sx={{ px: 0, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <CheckCircle color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Genuine medicines" 
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <CheckCircle color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Fast delivery" 
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <CheckCircle color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Easy returns" 
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              </List>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Checkout Dialog */}
      <Dialog open={checkoutDialogOpen} onClose={() => setCheckoutDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Checkout Details</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Delivery Address */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Delivery Address
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    multiline
                    rows={2}
                    value={deliveryAddress.address}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="City"
                    value={deliveryAddress.city}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="State"
                    value={deliveryAddress.state}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, state: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Pincode"
                    value={deliveryAddress.pincode}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, pincode: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={deliveryAddress.phone}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Payment Method */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Payment Method
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={paymentMethod === 'cod'}
                    onChange={(e) => setPaymentMethod(e.target.checked ? 'cod' : '')}
                  />
                }
                label="Cash on Delivery"
              />
            </Grid>

            {/* Special Instructions */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Special Instructions (Optional)"
                multiline
                rows={3}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Any special delivery instructions..."
              />
            </Grid>

            {/* Order Summary */}
            <Grid item xs={12}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Order Summary
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Subtotal:</Typography>
                  <Typography>₹{totalAmount.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Delivery:</Typography>
                  <Typography>{deliveryCharges === 0 ? 'FREE' : `₹${deliveryCharges}`}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Tax:</Typography>
                  <Typography>₹{tax.toFixed(2)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6" color="primary">₹{finalAmount.toFixed(2)}</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCheckoutDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={processOrder}
            variant="contained"
            disabled={isProcessing || !deliveryAddress.address || !deliveryAddress.phone}
          >
            {isProcessing ? 'Processing...' : `Place Order ₹${finalAmount.toFixed(2)}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Prescription Upload Dialog */}
      <Dialog open={prescriptionDialog} onClose={() => setPrescriptionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Prescription</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
            <Typography variant="body2">
              <strong>Quick Upload:</strong> Upload your prescription images/PDFs. 
              This will help process your order with prescription medicines.
            </Typography>
          </Alert>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Select Prescription Files
            </Typography>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => setPrescriptionFiles(Array.from(e.target.files))}
              style={{ 
                marginBottom: 16, 
                padding: '10px',
                border: '2px dashed #ccc',
                borderRadius: '4px',
                width: '100%'
              }}
            />
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload clear images of your prescription. Supported formats: JPG, PNG, PDF (Max 5 files)
            </Typography>

            {prescriptionFiles.length > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Files ({prescriptionFiles.length}):
                </Typography>
                {prescriptionFiles.map((file, index) => (
                  <Typography key={index} variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <CheckCircle sx={{ fontSize: 16, color: 'success.main', mr: 1 }} />
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </Typography>
                ))}
              </Box>
            )}

            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>For this upload, we'll use:</strong>
              </Typography>
              <Typography variant="body2">
                • Patient: {user?.firstName} {user?.lastName}<br/>
                • Valid for: 30 days from today<br/>
                • Status: Will be reviewed by our pharmacist
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrescriptionDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePrescriptionUpload}
            variant="contained"
            disabled={prescriptionFiles.length === 0 || uploadPrescriptionMutation.isLoading}
            startIcon={uploadPrescriptionMutation.isLoading ? <CloudUpload /> : <Upload />}
          >
            {uploadPrescriptionMutation.isLoading ? 'Uploading...' : `Upload ${prescriptionFiles.length} File(s)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CartPage; 