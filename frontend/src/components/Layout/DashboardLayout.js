import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  ShoppingCart,
  Receipt,
  Assignment,
  LocalShipping,
  Inventory,
  People,
  Analytics,
  Person,
  Logout,
  LocalPharmacy,
  Add,
  Description,
  Upload,
  Favorite,
  AdminPanelSettings,
  AccountBalance,
  Schedule,
  Assessment,
  Settings,
  CloudUpload,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';

const drawerWidth = 240;

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    handleClose();
  };

  // Define menu items based on user role
  const getMenuItems = () => {
    const baseItems = [
      { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard/overview' },
      { text: 'Profile', icon: <Person />, path: '/dashboard/profile' },
    ];

    const roleSpecificItems = {
      customer: [
        { text: 'Browse Medicines', icon: <LocalPharmacy />, path: '/medicines' },
        { text: 'Shopping Cart', icon: <ShoppingCart />, path: '/cart' },
        { text: 'Place Order', icon: <Add />, path: '/dashboard/place-order' },
        { text: 'My Orders', icon: <ShoppingCart />, path: '/dashboard/orders' },
        { text: 'My Prescriptions', icon: <Description />, path: '/dashboard/prescriptions' },
        { text: 'Upload Prescription', icon: <Upload />, path: '/dashboard/prescriptions/upload' },
        { text: 'Wishlist', icon: <Favorite />, path: '/dashboard/wishlist' },
      ],
      pharmacist: [
        { text: 'Inventory Management', icon: <Inventory />, path: '/dashboard/inventory' },
        { text: 'Add Medicine', icon: <Add />, path: '/dashboard/medicine-management' },
        { text: 'Prescription Reviews', icon: <Assignment />, path: '/dashboard/prescription-reviews' },
        { text: 'Order Management', icon: <ShoppingCart />, path: '/dashboard/order-management' },
      ],
      delivery_agent: [
        { text: 'My Deliveries', icon: <LocalShipping />, path: '/dashboard/deliveries' },
        { text: 'Earnings', icon: <AccountBalance />, path: '/dashboard/earnings' },
        { text: 'Availability', icon: <Schedule />, path: '/dashboard/availability' },
      ],
      admin: [
        { text: 'Admin Dashboard', icon: <AdminPanelSettings />, path: '/dashboard/admin' },
        { text: 'User Management', icon: <People />, path: '/dashboard/user-management' },
        { text: 'Inventory Management', icon: <Inventory />, path: '/dashboard/inventory' },
        { text: 'Order Management', icon: <ShoppingCart />, path: '/dashboard/order-management' },
        { text: 'Reports & Analytics', icon: <Assessment />, path: '/dashboard/reports' },
        { text: 'System Settings', icon: <Settings />, path: '/dashboard/system-settings' },
        { text: 'Bulk Operations', icon: <CloudUpload />, path: '/dashboard/bulk-operations' },
        { text: 'Browse Medicines', icon: <LocalPharmacy />, path: '/medicines' },
      ],
    };

    return [...baseItems, ...(roleSpecificItems[user?.role] || [])];
  };

  const menuItems = getMenuItems();

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalPharmacy color="primary" />
          <Typography variant="h6" noWrap component="div">
            E-Pharmacy
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigate('/dashboard/profile')}>
            <ListItemIcon><Person /></ListItemIcon>
            <ListItemText primary="Profile" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigate('/')}>
            <ListItemIcon><ShoppingCart /></ListItemIcon>
            <ListItemText primary="Continue Shopping" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {user?.role === 'customer' && 'Customer Dashboard'}
            {user?.role === 'pharmacist' && 'Pharmacist Dashboard'}
            {user?.role === 'delivery_agent' && 'Delivery Dashboard'}
            {user?.role === 'admin' && 'Admin Dashboard'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {user?.role === 'customer' && (
              <IconButton color="inherit" onClick={() => navigate('/cart')}>
                <Badge badgeContent={totalItems} color="secondary">
                  <ShoppingCart />
                </Badge>
              </IconButton>
            )}
            
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                {user?.firstName?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
            
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={() => { navigate('/dashboard/profile'); handleClose(); }}>
                <ListItemIcon><Person fontSize="small" /></ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="navigation menu"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout; 