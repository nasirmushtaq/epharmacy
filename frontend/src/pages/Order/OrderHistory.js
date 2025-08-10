import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
  Collapse,
  Alert
} from '@mui/material';
import {
  Visibility,
  MoreVert,
  Download,
  Cancel,
  Refresh,
  FilterList,
  Search,
  LocalPharmacy,
  CheckCircle,
  Schedule,
  LocalShipping,
  Error as ErrorIcon,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { toast } from 'react-toastify';
import axios from 'axios';

const OrderHistory = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery(
    ['orders', page, rowsPerPage, searchTerm, statusFilter],
    async () => {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await axios.get(`/api/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    },
    {
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to fetch orders');
      }
    }
  );

  const orders = ordersData?.data || [];
  const totalOrders = ordersData?.total || 0;

  const handleMenuOpen = (event, order) => {
    setAnchorEl(event.currentTarget);
    setSelectedOrder(order);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedOrder(null);
  };

  const handleViewOrder = (orderId) => {
    navigate(`/orders/${orderId}`);
  };

  const handleDownloadInvoice = (orderId) => {
    // TODO: Implement invoice download
    toast.info('Invoice download feature coming soon!');
    handleMenuClose();
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await axios.patch(`/api/orders/${orderId}/status`, 
        { status: 'cancelled' },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      toast.success('Order cancelled successfully');
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    }
    handleMenuClose();
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Schedule color="warning" />,
      confirmed: <CheckCircle color="info" />,
      processing: <LocalPharmacy color="primary" />,
      shipped: <LocalShipping color="secondary" />,
      delivered: <CheckCircle color="success" />,
      cancelled: <ErrorIcon color="error" />
    };
    return icons[status] || <Schedule />;
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Order History
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage all your orders
        </Typography>
      </Box>

      {/* Filters */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Orders</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="shipped">Shipped</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => refetch()}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>

            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                startIcon={<FilterList />}
                onClick={() => toast.info('Advanced filters coming soon!')}
                fullWidth
              >
                Filter
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
                You haven't placed any orders yet. Start shopping to see your orders here!
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/medicines')}
                sx={{ mt: 2 }}
              >
                Start Shopping
              </Button>
            </Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell>Order</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order) => (
                      <React.Fragment key={order._id}>
                        <TableRow hover>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => toggleOrderExpansion(order._id)}
                            >
                              {expandedOrder === order._id ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                          </TableCell>
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
                            <Typography variant="body2">
                              {formatDate(order.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 24, height: 24 }}>
                                <LocalPharmacy fontSize="small" />
                              </Avatar>
                              <Typography variant="body2">
                                {order.items.length} item{order.items.length > 1 ? 's' : ''}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {getStatusIcon(order.status)}
                              <Chip 
                                label={order.status.toUpperCase()} 
                                color={getStatusColor(order.status)}
                                size="small"
                              />
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2" fontWeight="bold">
                              ₹{order.totalAmount.toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewOrder(order._id)}
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                              <IconButton
                                size="small"
                                onClick={(e) => handleMenuOpen(e, order)}
                              >
                                <MoreVert />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Order Details */}
                        <TableRow>
                          <TableCell colSpan={7} sx={{ py: 0 }}>
                            <Collapse in={expandedOrder === order._id} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 2, px: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Order Items:
                                </Typography>
                                <Grid container spacing={2}>
                                  {order.items.map((item, index) => (
                                    <Grid item key={index} xs={12} sm={6} md={4}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                                        <Avatar
                                          src={item.medicine.images?.[0]?.url}
                                          sx={{ width: 40, height: 40 }}
                                        >
                                          <LocalPharmacy />
                                        </Avatar>
                                        <Box flex={1}>
                                          <Typography variant="body2" fontWeight="bold">
                                            {item.medicine.name}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            Qty: {item.quantity} × ₹{item.price} = ₹{item.total}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </Grid>
                                  ))}
                                </Grid>

                                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                                  <Typography variant="body2">
                                    <strong>Delivery:</strong> {order.deliveryAddress.city}, {order.deliveryAddress.state}
                                  </Typography>
                                  <Typography variant="body2">
                                    <strong>Payment:</strong> {order.payment.method === 'cash_on_delivery' ? 'COD' : 'Online'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={totalOrders}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuList>
          <MenuItemComponent onClick={() => handleViewOrder(selectedOrder?._id)}>
            <ListItemIcon>
              <Visibility />
            </ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItemComponent>
          
          <MenuItemComponent onClick={() => handleDownloadInvoice(selectedOrder?._id)}>
            <ListItemIcon>
              <Download />
            </ListItemIcon>
            <ListItemText>Download Invoice</ListItemText>
          </MenuItemComponent>
          
          {selectedOrder?.status === 'pending' && (
            <MenuItemComponent onClick={() => handleCancelOrder(selectedOrder?._id)}>
              <ListItemIcon>
                <Cancel />
              </ListItemIcon>
              <ListItemText>Cancel Order</ListItemText>
            </MenuItemComponent>
          )}
        </MenuList>
      </Menu>
    </Container>
  );
};

export default OrderHistory; 