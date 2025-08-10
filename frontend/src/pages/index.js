// This file exports all placeholder pages for the application
import React from 'react';
import PlaceholderPage from '../components/Common/PlaceholderPage';

// Medicines Pages
export const MedicinesPage = () => <PlaceholderPage title="Medicines" description="Browse and search medicines catalog." />;
export const MedicineDetailPage = () => <PlaceholderPage title="Medicine Details" description="Detailed medicine information and purchase options." />;

// Cart & Checkout Pages
export const CartPage = () => <PlaceholderPage title="Shopping Cart" description="Review items in your cart before checkout." />;
export const CheckoutPage = () => <PlaceholderPage title="Checkout" description="Complete your order and payment." />;

// Order Pages
export const OrderTrackingPage = () => <PlaceholderPage title="Order Tracking" description="Track your order status and delivery." />;
export const MyOrdersPage = () => <PlaceholderPage title="My Orders" description="View your order history and status." />;
export const OrderManagementPage = () => <PlaceholderPage title="Order Management" description="Manage and process customer orders." />;

// Dashboard Pages
export const CustomerDashboard = () => <PlaceholderPage title="Customer Dashboard" description="Your personal health and order overview." />;
export const PharmacistDashboard = () => <PlaceholderPage title="Pharmacist Dashboard" description="Manage prescriptions and pharmacy operations." />;
export const DeliveryDashboard = () => <PlaceholderPage title="Delivery Dashboard" description="Manage your delivery assignments." />;
export const AdminDashboard = () => <PlaceholderPage title="Admin Dashboard" description="System administration and analytics." />;

// Prescription Pages
export const MyPrescriptionsPage = () => <PlaceholderPage title="My Prescriptions" description="View your uploaded prescriptions and status." />;
export const UploadPrescriptionPage = () => <PlaceholderPage title="Upload Prescription" description="Upload prescription images for review." />;
export const PrescriptionReviewPage = () => <PlaceholderPage title="Prescription Review" description="Review and approve customer prescriptions." />;

// Profile Page
export const ProfilePage = () => <PlaceholderPage title="Profile" description="Manage your account information and settings." />;

// Inventory Page
export const InventoryPage = () => <PlaceholderPage title="Inventory Management" description="Manage medicine stock and inventory." />;

// Delivery Pages
export const MyDeliveriesPage = () => <PlaceholderPage title="My Deliveries" description="View and manage your delivery assignments." />;

// Admin Pages
export const UserManagementPage = () => <PlaceholderPage title="User Management" description="Manage system users and permissions." />;
export const SystemAnalyticsPage = () => <PlaceholderPage title="System Analytics" description="View system performance and analytics." />; 