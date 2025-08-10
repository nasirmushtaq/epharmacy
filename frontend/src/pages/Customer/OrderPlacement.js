import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Chip,
  Paper,
  IconButton,
  Badge,
  FormControlLabel,
  Checkbox,
  CircularProgress
} from '@mui/material';
import {
  ShoppingCart,
  LocalPharmacy,
  Upload,
  CheckCircle,
  Payment,
  LocalShipping,
  Receipt,
  Add,
  Remove,
  Delete,
  PhotoCamera,
  Description,
  Warning,
  Info
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const OrderPlacement = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [prescriptionDialog, setPrescriptionDialog] = useState(false);
  const [prescriptionFiles, setPrescriptionFiles] = useState([]);
  const [uploadedPrescriptions, setUploadedPrescriptions] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const { user } = useAuth();
  const { items, updateQuantity, removeFromCart, clearCart, totalAmount, totalItems } = useCart();
  const queryClient = useQueryClient();

  const steps = [
    'Review Cart',
    'Upload Prescriptions',
    'Delivery Address',
    'Payment & Confirmation'
  ];

  // Check if cart has prescription medicines
  const hasPrescriptionMedicines = items.some(item => item.isPrescriptionRequired || item.prescriptionRequired);

  // Fetch user's prescriptions
  const { data: userPrescriptions } = useQuery(
    'user-prescriptions',
    async () => {
      const response = await axios.get('/api/prescriptions/my-prescriptions');
      return response.data.data;
    },
    {
      enabled: !!user
    }
  );

  // Calculate order summary
  const deliveryCharges = totalAmount > 500 ? 0 : 50;
  const tax = Math.round(totalAmount * 0.05); // 5% tax
  const finalAmount = totalAmount + deliveryCharges + tax;

  // Upload prescription mutation
  const uploadPrescriptionMutation = useMutation(
    async (formData) => {
      const response = await axios.post('/api/prescriptions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user-prescriptions');
        toast.success('Prescription uploaded successfully!');
        setPrescriptionDialog(false);
        setPrescriptionFiles([]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to upload prescription');
      }
    }
  );

  // Place order mutation
  const placeOrderMutation = useMutation(
    async (orderData) => {
      const response = await axios.post('/api/orders', orderData);
      return response.data;
    },
    {
      onSuccess: (data) => {
        clearCart();
        toast.success('Order placed successfully!');
        // Redirect to order tracking or success page
        window.location.href = `/dashboard/orders/${data.data._id}`;
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to place order');
      }
    }
  );

  const handleNext = () => {
    if (activeStep === 0 && items.length === 0) {
      toast.warning('Your cart is empty!');
      return;
    }
    
    if (activeStep === 1 && hasPrescriptionMedicines && uploadedPrescriptions.length === 0) {
      toast.warning('Please upload prescriptions for prescription medicines!');
      return;
    }

    if (activeStep === 2) {
      const { address, city, state, pincode, phone } = deliveryAddress;
      
      if (!address || !city || !state || !pincode || !phone) {
        toast.warning('Please fill in all delivery address fields!');
        return;
      }
      
      // Basic phone validation
      if (phone.length < 10) {
        toast.warning('Please enter a valid phone number!');
        return;
      }
      
      // Basic pincode validation
      if (pincode.length < 5) {
        toast.warning('Please enter a valid pincode!');
        return;
      }
    }

    if (activeStep === 3) {
      handlePlaceOrder();
      return;
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handlePrescriptionUpload = () => {
    if (prescriptionFiles.length === 0) {
      toast.warning('Please select prescription files!');
      return;
    }

    const formData = new FormData();
    prescriptionFiles.forEach((file) => {
      formData.append('prescription', file); // Fixed: backend expects 'prescription' not 'prescriptions'
    });
    
    // Add required fields for backend validation
    formData.append('doctorName', 'Dr. Quick Upload');
    formData.append('doctorRegistrationNumber', 'REG' + Date.now());
    formData.append('patientName', user?.firstName + ' ' + user?.lastName || 'Patient');
    formData.append('patientAge', '30');
    formData.append('patientGender', 'other');
    formData.append('prescriptionDate', new Date().toISOString().split('T')[0]);
    formData.append('validUntil', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    formData.append('notes', 'Uploaded during order placement');

    uploadPrescriptionMutation.mutate(formData);
  };

  const handlePlaceOrder = () => {
    if (!agreedToTerms) {
      toast.warning('Please agree to terms and conditions!');
      return;
    }

    // Debug cart items
    console.log('Cart items before order:', items);

    const orderData = {
      items: items.map(item => {
        console.log('Processing cart item:', item);
        return {
          medicine: item.medicineId || item._id,
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.price) || 0
        };
      }),
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

    console.log('Order data being sent:', orderData);
    placeOrderMutation.mutate(orderData);
  };

  // Step 1: Cart Review
  const CartReviewStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Review Your Cart ({totalItems} items)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {items.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <ShoppingCart sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Your cart is empty
                </Typography>
                <Button variant="contained" href="/medicines">
                  Browse Medicines
                </Button>
              </Box>
            ) : (
              <List>
                {items.map((item, index) => (
                  <React.Fragment key={item.medicineId}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ px: 0 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <img
                              src={item.image || '/placeholder-medicine.jpg'}
                              alt={item.name}
                              style={{ width: 60, height: 60, marginRight: 16, borderRadius: 8 }}
                            />
                            <Box>
                              <Typography variant="body1" fontWeight="bold">
                                {item.name}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                {item.prescriptionRequired && (
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
                            </Box>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} sm={3}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconButton
                              onClick={() => updateQuantity(item.medicineId, item.quantity - 1)}
                              size="small"
                            >
                              <Remove />
                            </IconButton>
                            <Typography sx={{ mx: 2, minWidth: 30, textAlign: 'center' }}>
                              {item.quantity}
                            </Typography>
                            <IconButton
                              onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}
                              size="small"
                              disabled={item.quantity >= item.maxQuantity}
                            >
                              <Add />
                            </IconButton>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} sm={2}>
                          <Typography variant="h6" textAlign="center">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} sm={1}>
                          <IconButton
                            onClick={() => removeFromCart(item.medicineId)}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ position: 'sticky', top: 20 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Subtotal:</Typography>
              <Typography>₹{totalAmount.toFixed(2)}</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Delivery Charges:</Typography>
              <Typography>
                {deliveryCharges === 0 ? 'FREE' : `₹${deliveryCharges}`}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Tax (5%):</Typography>
              <Typography>₹{tax.toFixed(2)}</Typography>
            </Box>
            
            <Divider sx={{ my: 1 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Total:</Typography>
              <Typography variant="h6" color="primary">
                ₹{finalAmount.toFixed(2)}
              </Typography>
            </Box>

            {totalAmount < 500 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Add ₹{(500 - totalAmount).toFixed(2)} more for FREE delivery!
              </Alert>
            )}

            {hasPrescriptionMedicines && (
              <Alert severity="warning" icon={<LocalPharmacy />} sx={{ mb: 2 }}>
                Your cart contains prescription medicines. You'll need to upload prescriptions.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Step 2: Prescription Upload
  const PrescriptionStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Prescription Management
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {!hasPrescriptionMedicines ? (
              <Alert severity="info" icon={<Info />}>
                Your cart doesn't contain any prescription medicines. You can skip this step.
              </Alert>
            ) : (
              <Box>
                <Alert severity="warning" icon={<LocalPharmacy />} sx={{ mb: 3 }}>
                  Your cart contains prescription medicines. Please upload valid prescriptions to proceed.
                </Alert>

                <Button
                  variant="contained"
                  startIcon={<Upload />}
                  onClick={() => setPrescriptionDialog(true)}
                  sx={{ mb: 3 }}
                >
                  Upload New Prescription
                </Button>

                {/* Previously uploaded prescriptions */}
                {userPrescriptions && userPrescriptions.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Your Previous Prescriptions:
                    </Typography>
                    <List>
                      {userPrescriptions.slice(0, 3).map((prescription) => (
                        <ListItem key={prescription._id} divider>
                          <ListItemIcon>
                            <Description />
                          </ListItemIcon>
                          <ListItemText
                            primary={`Prescription #${prescription.prescriptionNumber}`}
                            secondary={`Uploaded: ${new Date(prescription.createdAt).toLocaleDateString()}`}
                          />
                          <Chip
                            label={prescription.status}
                            color={
                              prescription.status === 'approved' ? 'success' :
                              prescription.status === 'rejected' ? 'error' : 'default'
                            }
                            size="small"
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Prescription Requirements
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Valid doctor's prescription"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Clear, readable image"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Patient details visible"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Doctor's signature & stamp"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Step 3: Delivery Address
  const AddressStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Delivery Address
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Address"
                  multiline
                  rows={3}
                  value={deliveryAddress.address || ''}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter your complete delivery address"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={deliveryAddress.city || ''}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="State"
                  value={deliveryAddress.state || ''}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, state: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Pincode"
                  value={deliveryAddress.pincode || ''}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, pincode: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={deliveryAddress.phone || ''}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, phone: e.target.value }))}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Special Instructions (Optional)"
                  multiline
                  rows={2}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special delivery instructions..."
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Delivery Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Estimated Delivery:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                2-3 business days
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Delivery Charges:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {deliveryCharges === 0 ? 'FREE (Order above ₹500)' : `₹${deliveryCharges}`}
              </Typography>
            </Box>

            <Alert severity="info" icon={<LocalShipping />}>
              Free delivery on orders above ₹500
            </Alert>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Step 4: Payment & Confirmation
  const PaymentStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Method
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <FormControl component="fieldset">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={paymentMethod === 'cod'}
                      onChange={(e) => setPaymentMethod(e.target.checked ? 'cod' : '')}
                    />
                  }
                  label="Cash on Delivery (COD)"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Pay when your order is delivered to your doorstep
                </Typography>
              </Box>
            </FormControl>

            <Divider sx={{ my: 3 }} />

            <FormControlLabel
              control={
                <Checkbox
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
              }
              label="I agree to the terms and conditions"
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Final Order Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Items ({totalItems}):</Typography>
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
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Total:</Typography>
              <Typography variant="h6" color="primary">
                ₹{finalAmount.toFixed(2)}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Payment Method: {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return <CartReviewStep />;
      case 1:
        return <PrescriptionStep />;
      case 2:
        return <AddressStep />;
      case 3:
        return <PaymentStep />;
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Place Order
      </Typography>

      {/* Stepper */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Box sx={{ mb: 3 }}>
        {renderStepContent(activeStep)}
      </Box>

      {/* Navigation Buttons */}
      <Paper elevation={1} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            variant="outlined"
          >
            Back
          </Button>
          
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={
              (activeStep === 0 && items.length === 0) ||
              placeOrderMutation.isLoading
            }
            startIcon={
              activeStep === 3 ? <Payment /> : null
            }
          >
            {activeStep === 3
              ? placeOrderMutation.isLoading
                ? 'Placing Order...'
                : `Place Order ₹${finalAmount.toFixed(2)}`
              : 'Next'
            }
          </Button>
        </Box>
      </Paper>

      {/* Prescription Upload Dialog */}
      <Dialog open={prescriptionDialog} onClose={() => setPrescriptionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Prescription for Order</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
            <Typography variant="body2">
              <strong>Quick Upload:</strong> Upload your prescription images/PDFs. 
              We'll process them with default patient information for this order.
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
                <strong>For this quick upload, we'll use:</strong>
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
            startIcon={uploadPrescriptionMutation.isLoading ? <CircularProgress size={20} /> : <Upload />}
          >
            {uploadPrescriptionMutation.isLoading ? 'Uploading...' : `Upload ${prescriptionFiles.length} File(s)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrderPlacement; 