import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Pagination,
  CircularProgress,
  InputAdornment,
  Fab,
  Badge
} from '@mui/material';
import {
  Search,
  FilterList,
  ShoppingCart,
  Add,
  Remove,
  LocalPharmacy,
  Star,
  StarBorder,
  Visibility,
  ShoppingCartOutlined
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const MedicinesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [prescriptionRequired, setPrescriptionRequired] = useState('');

  const { addToCart, items } = useCart();
  const { user } = useAuth();

  // Fetch medicines with filters
  const { data: medicinesData, isLoading, error, refetch } = useQuery(
    ['medicines', { searchTerm, category, sortBy, sortOrder, page, priceRange, prescriptionRequired }],
    async () => {
      const params = new URLSearchParams({
        page,
        limit: 12,
        search: searchTerm,
        sort: `${sortOrder === 'desc' ? '-' : ''}${sortBy}`,
        ...(category && { category }),
        ...(priceRange.min && { minPrice: priceRange.min }),
        ...(priceRange.max && { maxPrice: priceRange.max }),
        ...(prescriptionRequired && { prescriptionRequired: prescriptionRequired === 'true' })
      });

      const response = await axios.get(`/api/medicines?${params}`);
      return response.data;
    }
  );

  // Fetch categories
  const { data: categories } = useQuery('categories', async () => {
    const response = await axios.get('/api/medicines/meta/categories');
    return response.data.data;
  });

  const handleAddToCart = async (medicine) => {
    try {
      if (medicine.isPrescriptionRequired && !user) {
        toast.warning('Please login to purchase prescription medicines');
        return;
      }

      // Pass the original medicine object to CartContext
      addToCart(medicine, 1);
      toast.success(`${medicine.name} added to cart!`);
    } catch (error) {
      toast.error('Failed to add to cart');
      console.error('Add to cart error:', error);
    }
  };

  const getCartQuantity = (medicineId) => {
    const cartItem = items.find(item => item.medicineId === medicineId);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleMedicineClick = async (medicine) => {
    setSelectedMedicine(medicine);
    // Track view
    try {
      await axios.get(`/api/medicines/${medicine._id}`);
    } catch (error) {
      console.error('Failed to track view');
    }
  };

  const MedicineCard = ({ medicine }) => {
    const cartQuantity = getCartQuantity(medicine._id);
            const isOutOfStock = (medicine.stockQuantity || medicine.stock || 0) === 0;

    return (
      <Card 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4
          }
        }}
        onClick={() => handleMedicineClick(medicine)}
      >
        <CardMedia
          component="img"
          height="200"
          image={medicine.images[0] || '/placeholder-medicine.jpg'}
          alt={medicine.name}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="h3" gutterBottom noWrap>
            {medicine.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {medicine.brand} | {medicine.strength} {medicine.unit}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {medicine.packSize} {medicine.unit}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Star color="warning" fontSize="small" />
            <Typography variant="body2" sx={{ ml: 0.5 }}>
              {medicine.averageRating?.toFixed(1) || 'N/A'} ({medicine.totalRatings || 0})
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {medicine.prescriptionRequired && (
              <Chip 
                label="Rx Required" 
                color="error" 
                size="small"
                icon={<LocalPharmacy />}
              />
            )}
            <Chip 
              label={medicine.category} 
              color="primary" 
              size="small" 
              variant="outlined"
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              {medicine.discount > 0 && (
                <Typography 
                  variant="body2" 
                  sx={{ textDecoration: 'line-through', color: 'text.secondary' }}
                >
                  ₹{medicine.mrp}
                </Typography>
              )}
              <Typography variant="h6" color="primary" fontWeight="bold">
                ₹{medicine.sellingPrice}
              </Typography>
              {medicine.discount > 0 && (
                <Typography variant="body2" color="success.main">
                  {medicine.discount}% OFF
                </Typography>
              )}
            </Box>
            
            <Typography 
              variant="body2" 
              color={isOutOfStock ? 'error' : 'success.main'}
            >
              {isOutOfStock ? 'Out of Stock' : `${medicine.stockQuantity || medicine.stock || 0} in stock`}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {cartQuantity > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    // Implement decrease quantity
                  }}
                >
                  <Remove />
                </IconButton>
                <Typography sx={{ mx: 1 }}>{cartQuantity}</Typography>
                <IconButton 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cartQuantity < (medicine.stockQuantity || medicine.stock || 0)) {
                      handleAddToCart(medicine);
                    }
                  }}
                  disabled={cartQuantity >= (medicine.stockQuantity || medicine.stock || 0)}
                >
                  <Add />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="contained"
                size="small"
                startIcon={<ShoppingCart />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(medicine);
                }}
                disabled={isOutOfStock}
                fullWidth
              >
                Add to Cart
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const MedicineDetailsDialog = () => (
    <Dialog 
      open={!!selectedMedicine} 
      onClose={() => setSelectedMedicine(null)}
      maxWidth="md"
      fullWidth
    >
      {selectedMedicine && (
        <>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5">{selectedMedicine.name}</Typography>
              <Chip 
                label={`₹${selectedMedicine.sellingPrice}`} 
                color="primary" 
                size="large"
              />
            </Box>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <img 
                  src={selectedMedicine.images[0] || '/placeholder-medicine.jpg'}
                  alt={selectedMedicine.name}
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Typography variant="h6" gutterBottom>Details</Typography>
                <Typography><strong>Brand:</strong> {selectedMedicine.brand}</Typography>
                <Typography><strong>Manufacturer:</strong> {selectedMedicine.manufacturer}</Typography>
                <Typography><strong>Generic Name:</strong> {selectedMedicine.genericName}</Typography>
                <Typography><strong>Strength:</strong> {selectedMedicine.strength} {selectedMedicine.unit}</Typography>
                <Typography><strong>Pack Size:</strong> {selectedMedicine.packSize}</Typography>
                <Typography><strong>Category:</strong> {selectedMedicine.category}</Typography>
                
                <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>Description</Typography>
                <Typography>{selectedMedicine.description}</Typography>
                
                {selectedMedicine.composition && (
                  <>
                    <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>Composition</Typography>
                    <Typography>{selectedMedicine.composition}</Typography>
                  </>
                )}
                
                {selectedMedicine.sideEffects && (
                  <>
                    <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>Side Effects</Typography>
                    <Typography>{selectedMedicine.sideEffects}</Typography>
                  </>
                )}
                
                {selectedMedicine.instructions && (
                  <>
                    <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>Instructions</Typography>
                    <Typography>{selectedMedicine.instructions}</Typography>
                  </>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedMedicine(null)}>Close</Button>
            <Button 
              variant="contained"
              startIcon={<ShoppingCart />}
              onClick={() => {
                handleAddToCart(selectedMedicine);
                setSelectedMedicine(null);
              }}
              disabled={(selectedMedicine.stockQuantity || selectedMedicine.stock || 0) === 0}
            >
              Add to Cart
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );

  const FilterDialog = () => (
    <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Filter Medicines</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                label="Category"
                onChange={(e) => setCategory(e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories?.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Min Price"
              type="number"
              value={priceRange.min}
              onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Max Price"
              type="number"
              value={priceRange.max}
              onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Prescription</InputLabel>
              <Select
                value={prescriptionRequired}
                label="Prescription"
                onChange={(e) => setPrescriptionRequired(e.target.value)}
              >
                <MenuItem value="">All Medicines</MenuItem>
                <MenuItem value="true">Prescription Required</MenuItem>
                <MenuItem value="false">Over the Counter</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => {
          setCategory('');
          setPriceRange({ min: '', max: '' });
          setPrescriptionRequired('');
        }}>
          Clear
        </Button>
        <Button onClick={() => setFilterDialogOpen(false)} variant="contained">
          Apply Filters
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Medicine Catalog
        </Typography>
        
        {/* Search and Filter Bar */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <TextField
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
            sx={{ flexGrow: 1, minWidth: 300 }}
          />
          
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setFilterDialogOpen(true)}
          >
            Filters
          </Button>
          
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={`${sortBy}_${sortOrder}`}
              label="Sort By"
              onChange={(e) => {
                const [field, order] = e.target.value.split('_');
                setSortBy(field);
                setSortOrder(order);
              }}
            >
              <MenuItem value="name_asc">Name A-Z</MenuItem>
              <MenuItem value="name_desc">Name Z-A</MenuItem>
              <MenuItem value="sellingPrice_asc">Price Low-High</MenuItem>
              <MenuItem value="sellingPrice_desc">Price High-Low</MenuItem>
              <MenuItem value="averageRating_desc">Highest Rated</MenuItem>
              <MenuItem value="viewCount_desc">Most Popular</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Active Filters */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {searchTerm && (
            <Chip 
              label={`Search: ${searchTerm}`} 
              onDelete={() => setSearchTerm('')} 
              color="primary"
            />
          )}
          {category && (
            <Chip 
              label={`Category: ${category}`} 
              onDelete={() => setCategory('')} 
              color="primary"
            />
          )}
          {priceRange.min && (
            <Chip 
              label={`Min: ₹${priceRange.min}`} 
              onDelete={() => setPriceRange(prev => ({ ...prev, min: '' }))} 
              color="primary"
            />
          )}
          {priceRange.max && (
            <Chip 
              label={`Max: ₹${priceRange.max}`} 
              onDelete={() => setPriceRange(prev => ({ ...prev, max: '' }))} 
              color="primary"
            />
          )}
        </Box>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load medicines. Please try again.
        </Alert>
      )}

      {/* Results */}
      {medicinesData && (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Showing {medicinesData.data.length} of {medicinesData.totalDocs} medicines
          </Typography>
          
          <Grid container spacing={3}>
            {medicinesData.data.map((medicine) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={medicine._id}>
                <MedicineCard medicine={medicine} />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {medicinesData.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={medicinesData.totalPages}
                page={page}
                onChange={(e, newPage) => setPage(newPage)}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}

      {/* Empty State */}
      {medicinesData && medicinesData.data.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <LocalPharmacy sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            No medicines found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Try adjusting your search criteria or filters
          </Typography>
        </Box>
      )}

      {/* Floating Cart Button */}
      {items.length > 0 && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000
          }}
          onClick={() => window.location.href = '/cart'}
        >
          <Badge badgeContent={items.length} color="error">
            <ShoppingCartOutlined />
          </Badge>
        </Fab>
      )}

      {/* Dialogs */}
      <MedicineDetailsDialog />
      <FilterDialog />
    </Container>
  );
};

export default MedicinesPage; 