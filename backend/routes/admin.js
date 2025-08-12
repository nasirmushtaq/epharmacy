const express = require('express');
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const Prescription = require('../models/Prescription');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
// Force-approve user
router.patch('/users/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isApproved: true, isActive: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Set order status (admin override)
router.patch('/orders/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.status = status;
    await order.save();
    res.json({ success: true, data: order });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Inventory adjustments (admin/pharmacist)
router.patch('/medicines/:id/stock', authenticate, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const { delta, set } = req.body;
    const med = await Medicine.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Medicine not found' });
    if (typeof set === 'number') med.stockQuantity = set; else if (typeof delta === 'number') med.stockQuantity = (med.stockQuantity || 0) + delta;
    await med.save();
    res.json({ success: true, data: med });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// @desc    Get dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Date filter for analytics
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const matchFilter = {};
    if (Object.keys(dateFilter).length > 0) {
      matchFilter.createdAt = dateFilter;
    }

    // Get current date ranges
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const thisWeek = new Date(today.setDate(today.getDate() - today.getDay()));

    // User statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: thisMonth }
    });
    
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Medicine statistics
    const totalMedicines = await Medicine.countDocuments({ isActive: true });
    const lowStockMedicines = await Medicine.countDocuments({
      $expr: { $lte: ['$stockQuantity', '$minStockLevel'] },
      isActive: true
    });
    const expiringSoonMedicines = await Medicine.countDocuments({
      expiryDate: { 
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        $gt: new Date()
      },
      isActive: true
    });

    // Prescription statistics
    const totalPrescriptions = await Prescription.countDocuments(matchFilter);
    const pendingPrescriptions = await Prescription.countDocuments({
      ...matchFilter,
      status: { $in: ['pending', 'under_review'] },
      isExpired: false
    });
    
    const prescriptionsByStatus = await Prescription.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Order statistics
    const totalOrders = await Order.countDocuments(matchFilter);
    const pendingOrders = await Order.countDocuments({
      ...matchFilter,
      status: { $in: ['pending', 'confirmed', 'processing'] }
    });
    
    const totalRevenue = await Order.aggregate([
      { 
        $match: { 
          ...matchFilter, 
          status: 'delivered' 
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    const thisMonthRevenue = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: thisMonth },
          status: 'delivered' 
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    const ordersByStatus = await Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Delivery statistics
    const totalDeliveries = await Delivery.countDocuments(matchFilter);
    const activeDeliveries = await Delivery.countDocuments({
      ...matchFilter,
      status: { $in: ['assigned', 'picked_up', 'in_transit'] }
    });
    
    const availableAgents = await User.countDocuments({
      role: 'delivery_agent',
      isActive: true,
      isAvailable: true
    });

    // Recent activities (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentOrders = await Order.find({
      createdAt: { $gte: sevenDaysAgo }
    })
    .populate('customer', 'firstName lastName')
    .select('orderNumber totalAmount status createdAt')
    .sort({ createdAt: -1 })
    .limit(10);

    const recentPrescriptions = await Prescription.find({
      createdAt: { $gte: sevenDaysAgo }
    })
    .populate('customer', 'firstName lastName')
    .select('prescriptionNumber status createdAt')
    .sort({ createdAt: -1 })
    .limit(10);

    // Daily analytics for charts (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          orderCount: { $sum: 1 },
          revenue: { 
            $sum: {
              $cond: [
                { $eq: ['$status', 'delivered'] },
                '$totalAmount',
                0
              ]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const dailyRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          users: {
            total: totalUsers,
            active: activeUsers,
            newThisMonth: newUsersThisMonth,
            byRole: usersByRole
          },
          medicines: {
            total: totalMedicines,
            lowStock: lowStockMedicines,
            expiringSoon: expiringSoonMedicines
          },
          prescriptions: {
            total: totalPrescriptions,
            pending: pendingPrescriptions,
            byStatus: prescriptionsByStatus
          },
          orders: {
            total: totalOrders,
            pending: pendingOrders,
            revenue: totalRevenue[0]?.total || 0,
            thisMonthRevenue: thisMonthRevenue[0]?.total || 0,
            byStatus: ordersByStatus
          },
          deliveries: {
            total: totalDeliveries,
            active: activeDeliveries,
            availableAgents: availableAgents
          }
        },
        recentActivity: {
          orders: recentOrders,
          prescriptions: recentPrescriptions
        },
        analytics: {
          dailyOrders,
          dailyRegistrations
        }
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get system health
// @route   GET /api/admin/system/health
// @access  Private (Admin only)
router.get('/system/health', authenticate, authorize('admin'), async (req, res) => {
  try {
    const dbStatus = 'connected'; // In real app, check actual DB connection
    const serverUptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Check critical system issues
    const lowStockCount = await Medicine.countDocuments({
      $expr: { $lte: ['$stockQuantity', '$minStockLevel'] },
      isActive: true
    });
    
    const expiredMedicinesCount = await Medicine.countDocuments({
      expiryDate: { $lt: new Date() },
      isActive: true
    });
    
    const stalledOrders = await Order.countDocuments({
      status: 'processing',
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24 hours
    });

    const systemAlerts = [];
    
    if (lowStockCount > 0) {
      systemAlerts.push({
        type: 'warning',
        message: `${lowStockCount} medicines are low in stock`,
        action: 'review_inventory'
      });
    }
    
    if (expiredMedicinesCount > 0) {
      systemAlerts.push({
        type: 'error',
        message: `${expiredMedicinesCount} medicines have expired`,
        action: 'remove_expired'
      });
    }
    
    if (stalledOrders > 0) {
      systemAlerts.push({
        type: 'warning',
        message: `${stalledOrders} orders are stalled in processing`,
        action: 'review_orders'
      });
    }

    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: dbStatus,
        uptime: serverUptime,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        },
        alerts: systemAlerts
      }
    });

  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      data: {
        status: 'unhealthy',
        error: error.message
      }
    });
  }
});

// @desc    Get top performing items
// @route   GET /api/admin/analytics/top-items
// @access  Private (Admin only)
router.get('/analytics/top-items', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { timeframe = '30', limit = 10 } = req.query;
    const days = parseInt(timeframe);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Top selling medicines
    const topMedicines = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'delivered'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.medicine',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id',
          foreignField: '_id',
          as: 'medicine'
        }
      },
      { $unwind: '$medicine' },
      {
        $project: {
          name: '$medicine.name',
          brand: '$medicine.brand',
          category: '$medicine.category',
          totalQuantity: 1,
          totalRevenue: 1,
          orderCount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Top customers by order value
    const topCustomers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: '$customer',
          totalSpent: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $project: {
          name: { $concat: ['$customer.firstName', ' ', '$customer.lastName'] },
          email: '$customer.email',
          totalSpent: 1,
          orderCount: 1
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Category performance
    const categoryPerformance = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'delivered'
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'medicines',
          localField: 'items.medicine',
          foreignField: '_id',
          as: 'medicine'
        }
      },
      { $unwind: '$medicine' },
      {
        $group: {
          _id: '$medicine.category',
          totalRevenue: { $sum: '$items.total' },
          totalQuantity: { $sum: '$items.quantity' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        timeframe: `${days} days`,
        topMedicines,
        topCustomers,
        categoryPerformance
      }
    });

  } catch (error) {
    console.error('Top items analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get revenue analytics
// @route   GET /api/admin/analytics/revenue
// @access  Private (Admin only)
router.get('/analytics/revenue', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;
    
    let groupBy, startDate, endDate;
    
    if (period === 'daily') {
      // Last 30 days
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      endDate = new Date();
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
    } else if (period === 'monthly') {
      // Current year by month
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
    } else {
      // Yearly - last 5 years
      startDate = new Date(year - 4, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
      groupBy = {
        year: { $year: '$createdAt' }
      };
    }

    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Calculate growth rate
    let growthRate = 0;
    if (revenueData.length >= 2) {
      const current = revenueData[revenueData.length - 1].revenue;
      const previous = revenueData[revenueData.length - 2].revenue;
      growthRate = ((current - previous) / previous) * 100;
    }

    res.json({
      success: true,
      data: {
        period,
        year: parseInt(year),
        revenueData,
        growthRate: parseFloat(growthRate.toFixed(2))
      }
    });

  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Bulk operations
// @route   POST /api/admin/bulk-operations
// @access  Private (Admin only)
router.post('/bulk-operations', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { operation, model, filter, update } = req.body;

    let result;
    
    switch (model) {
      case 'User':
        if (operation === 'update') {
          result = await User.updateMany(filter, update);
        } else if (operation === 'delete') {
          result = await User.updateMany(filter, { isActive: false });
        }
        break;
        
      case 'Medicine':
        if (operation === 'update') {
          result = await Medicine.updateMany(filter, update);
        } else if (operation === 'delete') {
          result = await Medicine.updateMany(filter, { isActive: false });
        }
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid model specified'
        });
    }

    res.json({
      success: true,
      message: `Bulk ${operation} completed successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Bulk operations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 