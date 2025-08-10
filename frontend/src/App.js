import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts
import MainLayout from './components/Layout/MainLayout';
import DashboardLayout from './components/Layout/DashboardLayout';
import ProtectedRoute from './components/Common/ProtectedRoute';

// Public Pages
import HomePage from './pages/Home/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import MedicinesPage from './pages/Medicine/MedicinesPage';
import CartPage from './pages/Cart/CartPage';

// Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard';

// Pharmacist Pages
import InventoryManagement from './pages/Pharmacist/InventoryManagement';
import PrescriptionReview from './pages/Pharmacist/PrescriptionReview';
import OrderManagement from './pages/Pharmacist/OrderManagement';

// Customer Pages
import OrderPlacement from './pages/Customer/OrderPlacement';
import PrescriptionManagement from './pages/Prescription/PrescriptionManagement';

// Order Pages
import OrderTracking from './pages/Order/OrderTracking';
import OrderHistory from './pages/Order/OrderHistory';

// Common Pages
import InvoicePayment from './pages/Common/InvoicePayment';

// Placeholder Pages
import PlaceholderPage from './components/Common/PlaceholderPage';

function App() {
  return (
    <>
      <Routes>
        {/* Public Routes with MainLayout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="medicines" element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <MedicinesPage />
            </ProtectedRoute>
          } />
          <Route path="cart" element={<CartPage />} />
        </Route>

        {/* Protected Routes with DashboardLayout */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          {/* Redirect based on role */}
          <Route index element={<Navigate to="/dashboard/overview" replace />} />
          
          {/* Common Dashboard Routes */}
          <Route path="overview" element={
            <PlaceholderPage 
              title="Dashboard Overview" 
              description="Your personalized dashboard based on your role." 
            />
          } />
          <Route path="profile" element={
            <PlaceholderPage 
              title="Profile Management" 
              description="Manage your profile information and settings." 
            />
          } />

          {/* Customer Routes */}
          <Route path="orders" element={
            <PlaceholderPage 
              title="My Orders" 
              description="View and track your orders." 
            />
          } />
          <Route path="orders/:id" element={
            <InvoicePayment />
          } />
          <Route path="place-order" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <OrderPlacement />
            </ProtectedRoute>
          } />
          <Route path="prescriptions" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <PrescriptionManagement />
            </ProtectedRoute>
          } />
          <Route path="prescriptions/upload" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <PrescriptionManagement />
            </ProtectedRoute>
          } />
          <Route path="orders" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <OrderHistory />
            </ProtectedRoute>
          } />
          <Route path="orders/:orderId" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <OrderTracking />
            </ProtectedRoute>
          } />
          <Route path="wishlist" element={
            <PlaceholderPage 
              title="Wishlist" 
              description="Your saved medicines and favorites." 
            />
          } />

          {/* Pharmacist Routes */}
          <Route path="inventory" element={
            <ProtectedRoute allowedRoles={['pharmacist', 'admin']}>
              <InventoryManagement />
            </ProtectedRoute>
          } />
          <Route path="medicine-management" element={
            <ProtectedRoute allowedRoles={['pharmacist', 'admin']}>
              <InventoryManagement />
            </ProtectedRoute>
          } />
          <Route path="prescription-reviews" element={
            <ProtectedRoute allowedRoles={['pharmacist', 'admin']}>
              <PrescriptionReview />
            </ProtectedRoute>
          } />
          <Route path="order-management" element={
            <ProtectedRoute allowedRoles={['pharmacist', 'admin']}>
              <OrderManagement />
            </ProtectedRoute>
          } />

          {/* Delivery Agent Routes */}
          <Route path="deliveries" element={
            <ProtectedRoute allowedRoles={['delivery_agent', 'admin']}>
              <PlaceholderPage 
                title="My Deliveries" 
                description="View and manage your assigned deliveries." 
              />
            </ProtectedRoute>
          } />
          <Route path="deliveries/:id" element={
            <ProtectedRoute allowedRoles={['delivery_agent', 'admin']}>
              <PlaceholderPage 
                title="Delivery Details" 
                description="Detailed view and tracking of delivery." 
              />
            </ProtectedRoute>
          } />
          <Route path="earnings" element={
            <ProtectedRoute allowedRoles={['delivery_agent', 'admin']}>
              <PlaceholderPage 
                title="Earnings" 
                description="View your delivery earnings and history." 
              />
            </ProtectedRoute>
          } />
          <Route path="availability" element={
            <ProtectedRoute allowedRoles={['delivery_agent', 'admin']}>
              <PlaceholderPage 
                title="Availability" 
                description="Manage your availability and work schedule." 
              />
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="user-management" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PlaceholderPage 
                title="User Management" 
                description="Manage all platform users and their permissions." 
              />
            </ProtectedRoute>
          } />
          <Route path="system-settings" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PlaceholderPage 
                title="System Settings" 
                description="Configure system-wide settings and preferences." 
              />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PlaceholderPage 
                title="Reports & Analytics" 
                description="View detailed reports and analytics." 
              />
            </ProtectedRoute>
          } />
          <Route path="bulk-operations" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PlaceholderPage 
                title="Bulk Operations" 
                description="Perform bulk operations on data." 
              />
            </ProtectedRoute>
          } />

          {/* Invoice and Payment Routes */}
          <Route path="invoice/:orderId" element={
            <InvoicePayment />
          } />
          <Route path="payment/:orderId" element={
            <InvoicePayment />
          } />
        </Route>

        {/* Public Order Placement Route */}
        <Route path="/place-order" element={
          <MainLayout>
            <OrderPlacement />
          </MainLayout>
        } />

        {/* Public tracking route */}
        <Route path="/track/:orderNumber" element={
          <MainLayout>
            <PlaceholderPage 
              title="Order Tracking" 
              description="Track your order delivery status." 
            />
          </MainLayout>
        } />

        {/* Public invoice route */}
        <Route path="/invoice/:orderId" element={
          <MainLayout>
            <InvoicePayment />
          </MainLayout>
        } />

        {/* Catch all route */}
        <Route path="*" element={
          <MainLayout>
            <PlaceholderPage 
              title="Page Not Found" 
              description="The page you're looking for doesn't exist." 
            />
          </MainLayout>
        } />
      </Routes>

      {/* Toast Notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}

export default App; 