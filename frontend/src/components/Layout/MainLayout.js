import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Badge, IconButton, Container } from '@mui/material';
import { ShoppingCart, AccountCircle, LocalPharmacy } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';

const MainLayout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { totalItems } = useCart();

  const handleAuthAction = () => {
    if (user) {
      logout();
    } else {
      navigate('/login');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ mr: 2 }}
          >
            <LocalPharmacy />
          </IconButton>
          
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            E-Pharmacy
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button 
              color="inherit" 
              onClick={() => navigate('/medicines')}
            >
              Medicines
            </Button>

            {user && (
              <Button 
                color="inherit" 
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </Button>
            )}

            <IconButton 
              color="inherit" 
              onClick={() => navigate('/cart')}
            >
              <Badge badgeContent={totalItems} color="secondary">
                <ShoppingCart />
              </Badge>
            </IconButton>

            {user ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton 
                  color="inherit" 
                  onClick={() => navigate('/dashboard/profile')}
                >
                  <AccountCircle />
                </IconButton>
                <Button 
                  color="inherit" 
                  onClick={handleAuthAction}
                >
                  Logout
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  color="inherit" 
                  onClick={() => navigate('/login')}
                >
                  Login
                </Button>
                <Button 
                  color="inherit" 
                  variant="outlined" 
                  sx={{ borderColor: 'white', '&:hover': { borderColor: 'white' } }}
                  onClick={() => navigate('/register')}
                >
                  Register
                </Button>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>

      {/* Footer */}
      <Box 
        component="footer" 
        sx={{ 
          bgcolor: 'grey.100', 
          py: 4, 
          mt: 'auto' 
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © 2024 E-Pharmacy. All rights reserved.
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Your trusted online medicine store
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default MainLayout; 