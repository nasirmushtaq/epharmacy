const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { authenticate } = require('../middleware/auth');

// @desc    Test email functionality
// @route   POST /api/email/test
// @access  Private (Admin only)
router.post('/test', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { to, type = 'otp' } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'Email address required'
      });
    }

    let result;

    switch (type) {
      case 'otp':
        result = await emailService.sendOTPEmail(to, '123456', 'testing');
        break;
      
      case 'order':
        const mockOrder = {
          orderNumber: 'TEST-ORDER-001',
          totalAmount: 150,
          subtotal: 130,
          deliveryCharges: 20,
          tax: 0,
          status: 'confirmed',
          createdAt: new Date(),
          items: [
            {
              medicine: { name: 'Test Medicine' },
              quantity: 2,
              price: 65,
              total: 130
            }
          ],
          deliveryAddress: {
            street: 'Test Address, Test City',
            city: 'Test City',
            state: 'Test State',
            zipCode: '123456',
            phone: '1234567890'
          }
        };
        
        const mockCustomer = {
          firstName: 'Test',
          lastName: 'User',
          email: to
        };
        
        result = await emailService.sendOrderConfirmationEmail(mockOrder, mockCustomer);
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid email type. Use: otp, order'
        });
    }

    res.json({
      success: true,
      message: `Test ${type} email sent successfully`,
      result
    });

  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message
    });
  }
});

module.exports = router;
