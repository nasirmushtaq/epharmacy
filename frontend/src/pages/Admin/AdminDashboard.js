import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  Dashboard,
  People,
  LocalPharmacy,
  ShoppingCart,
  TrendingUp,
  Warning,
  CheckCircle,
  Person,
  Edit,
  Delete,
  Add,
  Visibility,
  Download,
  Refresh,
  LocalShipping,
  Assessment,
  MonetizationOn,
  Inventory
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import { toast } from 'react-toastify';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionDialog, setActionDialog] = useState(false);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery('admin-dashboard', async () => {
    const response = await axios.get('/api/admin/dashboard');
    return response.data.data;
  });

  // Fetch system health
  const { data: systemHealth } = useQuery('system-health', async () => {
    const response = await axios.get('/api/admin/system/health');
    return response.data.data;
  });

  // Fetch analytics
  const { data: analytics } = useQuery('admin-analytics', async () => {
    const response = await axios.get('/api/admin/analytics/top-items');
    return response.data.data;
  });

  const StatCard = ({ title, value, subtitle, icon, color = 'primary', trend }) => (
    <Card elevation={2} sx={{ height: '100%' }}>
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
                <TrendingUp color={trend > 0 ? 'success' : 'error'} fontSize="small" />
                <Typography 
                  variant="body2" 
                  color={trend > 0 ? 'success.main' : 'error.main'}
                  sx={{ ml: 0.5 }}
                >
                  {trend > 0 ? '+' : ''}{trend}% from last month
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

  const OverviewTab = () => (
    <Grid container spacing={3}>
      {/* Key Metrics */}
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Users"
          value={dashboardData?.userStats?.total || 0}
          subtitle={`${dashboardData?.userStats?.active || 0} active users`}
          icon={<People fontSize="large" />}
          trend={12}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Orders"
          value={dashboardData?.orderStats?.total || 0}
          subtitle={`₹${dashboardData?.orderStats?.totalRevenue || 0} revenue`}
          icon={<ShoppingCart fontSize="large" />}
          color="success.main"
          trend={8}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Medicines"
          value={dashboardData?.medicineStats?.total || 0}
          subtitle={`${dashboardData?.medicineStats?.lowStock || 0} low stock`}
          icon={<LocalPharmacy fontSize="large" />}
          color="info.main"
          trend={-2}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Prescriptions"
          value={dashboardData?.prescriptionStats?.total || 0}
          subtitle={`${dashboardData?.prescriptionStats?.pending || 0} pending review`}
          icon={<Assessment fontSize="large" />}
          color="warning.main"
          trend={15}
        />
      </Grid>

      {/* Charts */}
      <Grid item xs={12} md={8}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Daily Orders & Revenue (Last 30 Days)
          </Typography>
          {dashboardData?.dailyTrends && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardData.dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="orders" fill="#8884d8" name="Orders" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" name="Revenue (₹)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={4}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            User Distribution
          </Typography>
          {dashboardData?.userStats && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Customers', value: dashboardData.userStats.customers },
                    { name: 'Pharmacists', value: dashboardData.userStats.pharmacists },
                    { name: 'Delivery Agents', value: dashboardData.userStats.deliveryAgents }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {['#0088FE', '#00C49F', '#FFBB28'].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Grid>

      {/* Recent Activity */}
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Orders
          </Typography>
          <List>
            {dashboardData?.recentOrders?.slice(0, 5).map((order) => (
              <ListItem key={order._id} divider>
                <ListItemIcon>
                  <ShoppingCart />
                </ListItemIcon>
                <ListItemText
                  primary={`Order #${order.orderNumber}`}
                  secondary={`₹${order.totalAmount} - ${order.customer.firstName} ${order.customer.lastName}`}
                />
                <Chip 
                  label={order.status} 
                  color={
                    order.status === 'delivered' ? 'success' :
                    order.status === 'cancelled' ? 'error' : 'primary'
                  }
                  size="small"
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            System Alerts
          </Typography>
          <List>
            {systemHealth?.alerts?.map((alert, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <Warning color={alert.type === 'error' ? 'error' : 'warning'} />
                </ListItemIcon>
                <ListItemText
                  primary={alert.message}
                  secondary={alert.details}
                />
              </ListItem>
            ))}
            {(!systemHealth?.alerts || systemHealth.alerts.length === 0) && (
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText primary="All systems operational" />
              </ListItem>
            )}
          </List>
        </Paper>
      </Grid>
    </Grid>
  );

  const UsersTab = () => {
    const { data: users, isLoading } = useQuery('admin-users', async () => {
      const response = await axios.get('/api/users?limit=50');
      return response.data.data;
    });

    return (
      <Paper elevation={2}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">User Management</Typography>
          <Button variant="contained" startIcon={<Add />}>
            Add User
          </Button>
        </Box>
        
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>{user.firstName} {user.lastName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.role} 
                        color={
                          user.role === 'admin' ? 'error' :
                          user.role === 'pharmacist' ? 'primary' :
                          user.role === 'delivery_agent' ? 'warning' : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={user.isActive ? 'Active' : 'Inactive'} 
                        color={user.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <Visibility />
                      </IconButton>
                      <IconButton size="small">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    );
  };

  const MedicinesTab = () => {
    const { data: medicines, isLoading } = useQuery('admin-medicines', async () => {
      const response = await axios.get('/api/medicines?limit=50');
      return response.data.data;
    });

    return (
      <Paper elevation={2}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Medicine Inventory</Typography>
          <Button variant="contained" startIcon={<Add />}>
            Add Medicine
          </Button>
        </Box>
        
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Medicine</TableCell>
                  <TableCell>Brand</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Stock</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {medicines?.map((medicine) => (
                  <TableRow key={medicine._id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <img 
                          src={medicine.images[0] || '/placeholder-medicine.jpg'} 
                          alt={medicine.name}
                          style={{ width: 40, height: 40, marginRight: 10, borderRadius: 4 }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {medicine.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {medicine.genericName}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{medicine.brand}</TableCell>
                    <TableCell>{medicine.category}</TableCell>
                    <TableCell>₹{medicine.sellingPrice}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography 
                          color={(medicine.stockQuantity || medicine.stock || 0) < medicine.minStockLevel ? 'error' : 'inherit'}
                        >
                          {medicine.stockQuantity || medicine.stock || 0}
                        </Typography>
                        {(medicine.stockQuantity || medicine.stock || 0) < medicine.minStockLevel && (
                          <Warning color="error" fontSize="small" sx={{ ml: 1 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={medicine.isActive ? 'Active' : 'Inactive'} 
                        color={medicine.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <Edit />
                      </IconButton>
                      <IconButton size="small">
                        <Inventory />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    );
  };

  const OrdersTab = () => {
    const { data: orders, isLoading } = useQuery('admin-orders', async () => {
      const response = await axios.get('/api/orders/status/pending');
      return response.data.data;
    });

    return (
      <Paper elevation={2}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Order Management</Typography>
        </Box>
        
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.customer.firstName} {order.customer.lastName}</TableCell>
                    <TableCell>{order.items.length} items</TableCell>
                    <TableCell>₹{order.totalAmount}</TableCell>
                    <TableCell>
                      <Chip 
                        label={order.status} 
                        color={
                          order.status === 'delivered' ? 'success' :
                          order.status === 'cancelled' ? 'error' : 'primary'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <Visibility />
                      </IconButton>
                      <IconButton size="small">
                        <LocalShipping />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    );
  };

  const AnalyticsTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Top Selling Medicines
          </Typography>
          {analytics?.topMedicines && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topMedicines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="salesCount" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Revenue by Category
          </Typography>
          {analytics?.categoryPerformance && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.categoryPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {analytics.categoryPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Top Customers
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Orders</TableCell>
                  <TableCell>Total Spent</TableCell>
                  <TableCell>Avg Order Value</TableCell>
                  <TableCell>Last Order</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analytics?.topCustomers?.map((customer) => (
                  <TableRow key={customer._id}>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.orderCount}</TableCell>
                    <TableCell>₹{customer.totalSpent}</TableCell>
                    <TableCell>₹{(customer.totalSpent / customer.orderCount).toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(customer.lastOrderDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>
    </Grid>
  );

  const tabs = [
    { label: 'Overview', icon: <Dashboard /> },
    { label: 'Users', icon: <People /> },
    { label: 'Medicines', icon: <LocalPharmacy /> },
    { label: 'Orders', icon: <ShoppingCart /> },
    { label: 'Analytics', icon: <Assessment /> }
  ];

  if (dashboardLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Admin Dashboard
        </Typography>
        <Box>
          <Button startIcon={<Download />} sx={{ mr: 1 }}>
            Export Data
          </Button>
          <Button startIcon={<Refresh />} variant="outlined">
            Refresh
          </Button>
        </Box>
      </Box>

      <Paper elevation={1} sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab 
              key={index}
              label={tab.label} 
              icon={tab.icon} 
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      <Box sx={{ mt: 3 }}>
        {activeTab === 0 && <OverviewTab />}
        {activeTab === 1 && <UsersTab />}
        {activeTab === 2 && <MedicinesTab />}
        {activeTab === 3 && <OrdersTab />}
        {activeTab === 4 && <AnalyticsTab />}
      </Box>
    </Container>
  );
};

export default AdminDashboard; 