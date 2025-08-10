import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Divider,
  InputAdornment,
  Switch,
  FormControlLabel,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  FilterList,
  Upload,
  Inventory,
  Warning,
  CheckCircle,
  LocalPharmacy,
  PhotoCamera,
  Save,
  Cancel,
  Visibility,
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Category,
  Schedule
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

// Validation schema for medicine form
const medicineSchema = yup.object().shape({
  name: yup.string().required('Medicine name is required'),
  genericName: yup.string().required('Generic name is required'),
  brand: yup.string().required('Brand is required'),
  manufacturer: yup.string().required('Manufacturer is required'),
  category: yup.string().required('Category is required'),
  description: yup.string().required('Description is required'),
  composition: yup.string().required('Composition is required'),
  dosage: yup.string().required('Dosage is required'),
  dosageForm: yup.string().required('Dosage form is required'),
  strength: yup.string().required('Strength is required'),
  unit: yup.string().required('Unit is required'),
  packSize: yup.number().positive().required('Pack size is required'),
  mrp: yup.number().positive().required('MRP is required'),
  sellingPrice: yup.number().positive().required('Selling price is required'),
  discount: yup.number().min(0).max(100),
  stockQuantity: yup.number().min(0).required('Stock quantity is required'),
  minStockLevel: yup.number().min(0).required('Minimum stock level is required'),
  maxStockLevel: yup.number().min(0).required('Maximum stock level is required'),
  manufacturingDate: yup.date().required('Manufacturing date is required'),
  expiryDate: yup.date().required('Expiry date is required'),
  batchNumber: yup.string().required('Batch number is required'),
  scheduleType: yup.string().required('Schedule type is required'),
  usageInstructions: yup.string().required('Usage instructions are required'),
  storageInstructions: yup.string().required('Storage instructions are required'),
  prescriptionRequired: yup.boolean(),
  sideEffects: yup.string(),
  instructions: yup.string(),
  tags: yup.string()
});

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [addMedicineDialog, setAddMedicineDialog] = useState(false);
  const [editMedicine, setEditMedicine] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);

  const queryClient = useQueryClient();

  // Fetch medicines
  const { data: medicines, isLoading, error } = useQuery(
    ['medicines', { search: searchTerm, category: filterCategory, status: filterStatus }],
    async () => {
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(filterCategory && { category: filterCategory }),
        ...(filterStatus && { status: filterStatus }),
        limit: 100
      });
      const response = await axios.get(`/api/medicines?${params}`);
      return response.data.data;
    }
  );

  // Fetch categories
  const { data: categories } = useQuery('medicine-categories', async () => {
    const response = await axios.get('/api/medicines/meta/categories');
    return response.data.data;
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery('inventory-stats', async () => {
    const response = await axios.get('/api/admin/dashboard');
    return response.data.data?.medicineStats;
  });

  // Form handling
  const { control, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: yupResolver(medicineSchema),
    defaultValues: {
      prescriptionRequired: false,
      discount: 0,
      tags: ''
    }
  });

  // Image upload handling
  const onDrop = (acceptedFiles) => {
    const imageFiles = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );
    setUploadedImages(prev => [...prev, ...imageFiles]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 5
  });

  // Mutations
  const addMedicineMutation = useMutation(
    async (formData) => {
      const response = await axios.post('/api/medicines', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('medicines');
        queryClient.invalidateQueries('inventory-stats');
        toast.success('Medicine added successfully!');
        setAddMedicineDialog(false);
        reset();
        setUploadedImages([]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add medicine');
      }
    }
  );

  const updateMedicineMutation = useMutation(
    async ({ id, formData }) => {
      const response = await axios.put(`/api/medicines/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('medicines');
        toast.success('Medicine updated successfully!');
        setEditMedicine(null);
        reset();
        setUploadedImages([]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update medicine');
      }
    }
  );

  const updateStockMutation = useMutation(
    async ({ id, newStock, currentStock }) => {
      const difference = newStock - currentStock;
      const operation = difference >= 0 ? 'add' : 'subtract';
      const quantity = Math.abs(difference);
      
      const response = await axios.patch(`/api/medicines/${id}/stock`, { 
        quantity: quantity,
        operation: operation
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('medicines');
        toast.success('Stock updated successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update stock');
      }
    }
  );

  const deleteMedicineMutation = useMutation(
    async (id) => {
      const response = await axios.delete(`/api/medicines/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('medicines');
        toast.success('Medicine removed successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to remove medicine');
      }
    }
  );

  // Form submission
  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      
      // Add form fields with proper formatting
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
          let value = data[key];
          
          // Format dates to ISO string
          if (key === 'manufacturingDate' || key === 'expiryDate') {
            if (value instanceof Date) {
              value = value.toISOString().split('T')[0];
            } else if (typeof value === 'string' && value.includes('GMT')) {
              value = new Date(value).toISOString().split('T')[0];
            }
          }
          
          // Handle tags as comma-separated string
          if (key === 'tags' && typeof value === 'string') {
            value = value.split(',').map(tag => tag.trim()).join(',');
          }
          
          formData.append(key, value);
        }
      });

      // Add images
      uploadedImages.forEach((image, index) => {
        formData.append('medicineImage', image);
      });

      if (editMedicine) {
        await updateMedicineMutation.mutateAsync({ id: editMedicine._id, formData });
      } else {
        await addMedicineMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleEditMedicine = (medicine) => {
    setEditMedicine(medicine);
    reset({
      name: medicine.name || '',
      genericName: medicine.genericName || '',
      brand: medicine.brand || '',
      manufacturer: medicine.manufacturer || '',
      category: medicine.category || '',
      description: medicine.description || '',
      composition: medicine.composition || '',
      dosage: medicine.dosage || '',
      dosageForm: medicine.dosageForm || '',
      strength: medicine.strength || '',
      unit: medicine.unit || '',
      packSize: medicine.packSize || '',
      mrp: medicine.mrp || '',
      sellingPrice: medicine.sellingPrice || '',
      discount: medicine.discount || 0,
      stockQuantity: medicine.stockQuantity || medicine.stock || '', // Handle both old and new field names
      minStockLevel: medicine.minStockLevel || '',
      maxStockLevel: medicine.maxStockLevel || '',
      manufacturingDate: medicine.manufacturingDate ? medicine.manufacturingDate.split('T')[0] : '',
      expiryDate: medicine.expiryDate ? medicine.expiryDate.split('T')[0] : '',
      batchNumber: medicine.batchNumber || '',
      scheduleType: medicine.scheduleType || '',
      usageInstructions: medicine.usageInstructions || '',
      storageInstructions: medicine.storageInstructions || '',
      prescriptionRequired: medicine.prescriptionRequired || false,
      sideEffects: medicine.sideEffects || '',
      instructions: medicine.instructions || '',
      tags: medicine.tags?.join(', ') || ''
    });
    setUploadedImages([]);
    setAddMedicineDialog(true);
  };

  const handleStockUpdate = (medicineId, newStock, currentStock) => {
    updateStockMutation.mutate({ id: medicineId, newStock: newStock, currentStock: currentStock });
  };

  // Stats cards component
  const StatsCard = ({ title, value, subtitle, icon, color = 'primary', trend }) => (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" color={color}>
              {value}
            </Typography>
            {subtitle && (
              <Typography color="textSecondary" variant="body2">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {trend > 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
                <Typography 
                  variant="body2" 
                  color={trend > 0 ? 'success.main' : 'error.main'}
                  sx={{ ml: 0.5 }}
                >
                  {Math.abs(trend)}% this month
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: 'text.secondary' }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Inventory overview tab
  const InventoryOverview = () => (
    <Grid container spacing={3}>
      {/* Stats Cards */}
      <Grid item xs={12} sm={6} md={3}>
        <StatsCard
          title="Total Medicines"
          value={stats?.total || 0}
          icon={<LocalPharmacy fontSize="large" />}
          trend={5}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatsCard
          title="Low Stock Items"
          value={stats?.lowStock || 0}
          subtitle="Require restocking"
          icon={<Warning fontSize="large" />}
          color="warning.main"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatsCard
          title="Expired Items"
          value={stats?.expired || 0}
          subtitle="Need attention"
          icon={<Schedule fontSize="large" />}
          color="error.main"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatsCard
          title="Total Value"
          value={`₹${stats?.totalValue?.toLocaleString() || 0}`}
          subtitle="Inventory worth"
          icon={<AttachMoney fontSize="large" />}
          color="success.main"
          trend={12}
        />
      </Grid>

      {/* Quick Actions */}
      <Grid item xs={12}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Add />}
                  onClick={() => setAddMedicineDialog(true)}
                >
                  Add Medicine
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Upload />}
                >
                  Bulk Import
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Warning />}
                  onClick={() => setFilterStatus('lowStock')}
                >
                  View Low Stock
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Schedule />}
                  onClick={() => setFilterStatus('expired')}
                >
                  View Expired
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Low Stock Alert */}
      {stats?.lowStock > 0 && (
        <Grid item xs={12}>
          <Alert severity="warning" icon={<Warning />}>
            You have {stats.lowStock} medicines with low stock levels. Consider restocking soon.
          </Alert>
        </Grid>
      )}

      {/* Expired Items Alert */}
      {stats?.expired > 0 && (
        <Grid item xs={12}>
          <Alert severity="error" icon={<Schedule />}>
            You have {stats.expired} expired medicines that need immediate attention.
          </Alert>
        </Grid>
      )}
    </Grid>
  );

  // Medicine management tab
  const MedicineManagement = () => (
    <Box>
      {/* Search and Filter Bar */}
      <Card elevation={1} sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  label="Category"
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories?.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="lowStock">Low Stock</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Add />}
                onClick={() => setAddMedicineDialog(true)}
              >
                Add Medicine
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Medicines Table */}
      <Card elevation={2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Medicine</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <LinearProgress />
                  </TableCell>
                </TableRow>
              ) : (
                medicines?.map((medicine) => (
                  <TableRow key={medicine._id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          src={medicine.images?.[0]}
                          alt={medicine.name}
                          sx={{ mr: 2, width: 40, height: 40 }}
                        >
                          <LocalPharmacy />
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            {medicine.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {medicine.brand} | {medicine.strength} {medicine.unit}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{medicine.category}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography
                          color={medicine.stockQuantity < medicine.minStockLevel ? 'error' : 'inherit'}
                        >
                          {medicine.stockQuantity}
                        </Typography>
                        {medicine.stockQuantity < medicine.minStockLevel && (
                          <Warning color="error" fontSize="small" sx={{ ml: 1 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1">₹{medicine.sellingPrice}</Typography>
                      {medicine.discount > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          MRP: ₹{medicine.mrp} ({medicine.discount}% off)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          new Date(medicine.expiryDate) < new Date() ? 'Expired' :
                          medicine.stockQuantity < medicine.minStockLevel ? 'Low Stock' :
                          medicine.isActive ? 'Active' : 'Inactive'
                        }
                        color={
                          new Date(medicine.expiryDate) < new Date() ? 'error' :
                          medicine.stockQuantity < medicine.minStockLevel ? 'warning' :
                          medicine.isActive ? 'success' : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(medicine.expiryDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditMedicine(medicine)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          const newStock = prompt('Enter new stock quantity:', medicine.stockQuantity);
                          if (newStock !== null && !isNaN(newStock)) {
                            handleStockUpdate(medicine._id, parseInt(newStock), medicine.stockQuantity);
                          }
                        }}
                      >
                        <Inventory />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to remove this medicine?')) {
                            deleteMedicineMutation.mutate(medicine._id);
                          }
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Inventory Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddMedicineDialog(true)}
        >
          Add Medicine
        </Button>
      </Box>

      {/* Tabs */}
      <Paper elevation={1} sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" icon={<Inventory />} iconPosition="start" />
          <Tab label="Manage Medicines" icon={<LocalPharmacy />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {activeTab === 0 && <InventoryOverview />}
        {activeTab === 1 && <MedicineManagement />}
      </Box>

      {/* Add/Edit Medicine Dialog */}
      <Dialog
        open={addMedicineDialog}
        onClose={() => {
          setAddMedicineDialog(false);
          setEditMedicine(null);
          reset();
          setUploadedImages([]);
        }}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editMedicine ? 'Edit Medicine' : 'Add New Medicine'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Medicine Name"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="genericName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Generic Name"
                      error={!!errors.genericName}
                      helperText={errors.genericName?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="brand"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Brand"
                      error={!!errors.brand}
                      helperText={errors.brand?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="manufacturer"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Manufacturer"
                      error={!!errors.manufacturer}
                      helperText={errors.manufacturer?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.category}>
                      <InputLabel>Category</InputLabel>
                      <Select {...field} label="Category">
                        <MenuItem value="tablets">Tablets</MenuItem>
                        <MenuItem value="capsules">Capsules</MenuItem>
                        <MenuItem value="syrups">Syrups</MenuItem>
                        <MenuItem value="injections">Injections</MenuItem>
                        <MenuItem value="ointments">Ointments</MenuItem>
                        <MenuItem value="drops">Drops</MenuItem>
                        <MenuItem value="inhalers">Inhalers</MenuItem>
                        <MenuItem value="supplements">Supplements</MenuItem>
                        <MenuItem value="antibiotics">Antibiotics</MenuItem>
                        <MenuItem value="painkillers">Painkillers</MenuItem>
                        <MenuItem value="diabetes">Diabetes</MenuItem>
                        <MenuItem value="heart">Heart</MenuItem>
                        <MenuItem value="blood_pressure">Blood Pressure</MenuItem>
                        <MenuItem value="vitamins">Vitamins</MenuItem>
                        <MenuItem value="others">Others</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="prescriptionRequired"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Prescription Required"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Description"
                      multiline
                      rows={3}
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </Grid>

              {/* Composition & Dosage */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Composition & Dosage
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="composition"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Composition"
                      multiline
                      rows={2}
                      error={!!errors.composition}
                      helperText={errors.composition?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="dosage"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Dosage"
                      error={!!errors.dosage}
                      helperText={errors.dosage?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="strength"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Strength"
                      error={!!errors.strength}
                      helperText={errors.strength?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="unit"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.unit}>
                      <InputLabel>Unit</InputLabel>
                      <Select {...field} label="Unit">
                        <MenuItem value="tablets">Tablets</MenuItem>
                        <MenuItem value="capsules">Capsules</MenuItem>
                        <MenuItem value="ml">ml</MenuItem>
                        <MenuItem value="grams">Grams</MenuItem>
                        <MenuItem value="pieces">Pieces</MenuItem>
                        <MenuItem value="strips">Strips</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="dosageForm"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.dosageForm}>
                      <InputLabel>Dosage Form</InputLabel>
                      <Select {...field} label="Dosage Form">
                        <MenuItem value="tablet">Tablet</MenuItem>
                        <MenuItem value="capsule">Capsule</MenuItem>
                        <MenuItem value="syrup">Syrup</MenuItem>
                        <MenuItem value="injection">Injection</MenuItem>
                        <MenuItem value="cream">Cream</MenuItem>
                        <MenuItem value="ointment">Ointment</MenuItem>
                        <MenuItem value="drops">Drops</MenuItem>
                        <MenuItem value="inhaler">Inhaler</MenuItem>
                        <MenuItem value="patch">Patch</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="scheduleType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.scheduleType}>
                      <InputLabel>Schedule Type</InputLabel>
                      <Select {...field} label="Schedule Type">
                        <MenuItem value="OTC">Over the Counter (OTC)</MenuItem>
                        <MenuItem value="H">Schedule H</MenuItem>
                        <MenuItem value="H1">Schedule H1</MenuItem>
                        <MenuItem value="X">Narcotic (Schedule X)</MenuItem>
                        <MenuItem value="G">Schedule G</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Pricing & Stock */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Pricing & Stock
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="packSize"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Pack Size"
                      type="number"
                      error={!!errors.packSize}
                      helperText={errors.packSize?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="mrp"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="MRP (₹)"
                      type="number"
                      error={!!errors.mrp}
                      helperText={errors.mrp?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="sellingPrice"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Selling Price (₹)"
                      type="number"
                      error={!!errors.sellingPrice}
                      helperText={errors.sellingPrice?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="discount"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Discount (%)"
                      type="number"
                      inputProps={{ min: 0, max: 100 }}
                      error={!!errors.discount}
                      helperText={errors.discount?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="stockQuantity"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Current Stock"
                      type="number"
                      error={!!errors.stockQuantity}
                      helperText={errors.stockQuantity?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="minStockLevel"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Min Stock Level"
                      type="number"
                      error={!!errors.minStockLevel}
                      helperText={errors.minStockLevel?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="maxStockLevel"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Max Stock Level"
                      type="number"
                      error={!!errors.maxStockLevel}
                      helperText={errors.maxStockLevel?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="batchNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Batch Number"
                      error={!!errors.batchNumber}
                      helperText={errors.batchNumber?.message}
                    />
                  )}
                />
              </Grid>

              {/* Dates */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Important Dates
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="manufacturingDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Manufacturing Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.manufacturingDate}
                      helperText={errors.manufacturingDate?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="expiryDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Expiry Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.expiryDate}
                      helperText={errors.expiryDate?.message}
                    />
                  )}
                />
              </Grid>

              {/* Additional Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Additional Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="usageInstructions"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Usage Instructions"
                      multiline
                      rows={3}
                      required
                      error={!!errors.usageInstructions}
                      helperText={errors.usageInstructions?.message}
                      placeholder="e.g., Take 1 tablet every 4-6 hours as needed for pain relief"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="storageInstructions"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Storage Instructions"
                      multiline
                      rows={2}
                      required
                      error={!!errors.storageInstructions}
                      helperText={errors.storageInstructions?.message}
                      placeholder="e.g., Store in a cool, dry place away from direct sunlight"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="sideEffects"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Side Effects (Optional)"
                      multiline
                      rows={2}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="instructions"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Additional Instructions (Optional)"
                      multiline
                      rows={2}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Tags (comma separated)"
                      placeholder="e.g., fever, headache, pain relief"
                    />
                  )}
                />
              </Grid>

              {/* Image Upload */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Product Images
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box
                  {...getRootProps()}
                  sx={{
                    border: '2px dashed #ccc',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main' }
                  }}
                >
                  <input {...getInputProps()} />
                  <PhotoCamera sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography>
                    {isDragActive
                      ? "Drop the images here..."
                      : "Drag 'n' drop images here, or click to select"
                    }
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Max 5 images, JPEG/PNG only
                  </Typography>
                </Box>

                {uploadedImages.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Uploaded Images:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {uploadedImages.map((image, index) => (
                        <Box key={index} sx={{ position: 'relative' }}>
                          <img
                            src={image.preview}
                            alt={`Upload ${index}`}
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
                          />
                          <IconButton
                            size="small"
                            sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: 'white' }}
                            onClick={() => {
                              const newImages = [...uploadedImages];
                              newImages.splice(index, 1);
                              setUploadedImages(newImages);
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => {
                setAddMedicineDialog(false);
                setEditMedicine(null);
                reset();
                setUploadedImages([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={addMedicineMutation.isLoading || updateMedicineMutation.isLoading}
              startIcon={<Save />}
            >
              {addMedicineMutation.isLoading || updateMedicineMutation.isLoading
                ? 'Saving...'
                : editMedicine
                ? 'Update Medicine'
                : 'Add Medicine'
              }
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default InventoryManagement; 