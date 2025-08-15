const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const config = require('../config/config');

class EmailService {
  constructor() {
    this.resend = null;
    this.gmailTransporter = null;
    this.initializeServices();
  }

  initializeServices() {
    // Initialize Resend (Primary - 3000 emails/month free)
    if (config.email.resendApiKey) {
      this.resend = new Resend(config.email.resendApiKey);
      console.log('📧 Resend email service initialized');
    }

    // Initialize Gmail SMTP (Fallback - unlimited for personal use)
    if (config.email.gmail.user && config.email.gmail.password) {
      this.gmailTransporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: config.email.gmail.user,
          pass: config.email.gmail.password // Use App Password, not regular password
        }
      });
      console.log('📧 Gmail SMTP service initialized');
    }

    if (!this.resend && !this.gmailTransporter) {
      console.warn('⚠️ No email service configured. Emails will be logged only.');
    }
  }

  async sendEmail({ to, subject, html, text }) {
    const emailData = {
      from: config.email.fromAddress,
      to,
      subject,
      html,
      text: text || this.stripHtml(html)
    };

    try {
      // Try Resend first (preferred)
      if (this.resend) {
        const result = await this.resend.emails.send(emailData);
        console.log(`📧 Email sent via Resend to ${to}: ${subject}`);
        return { success: true, provider: 'resend', id: result.id };
      }

      // Fallback to Gmail SMTP
      if (this.gmailTransporter) {
        const result = await this.gmailTransporter.sendMail(emailData);
        console.log(`📧 Email sent via Gmail to ${to}: ${subject}`);
        return { success: true, provider: 'gmail', id: result.messageId };
      }

      // No service available - log only
      console.log(`📧 [EMAIL LOG] To: ${to}, Subject: ${subject}`);
      console.log(`📧 [EMAIL CONTENT] ${text || this.stripHtml(html)}`);
      return { success: true, provider: 'log', id: 'logged' };

    } catch (error) {
      console.error(`❌ Email send failed to ${to}:`, error.message);
      
      // If Resend fails, try Gmail as fallback
      if (this.resend && this.gmailTransporter && error.name !== 'GmailError') {
        try {
          const result = await this.gmailTransporter.sendMail(emailData);
          console.log(`📧 Email sent via Gmail (fallback) to ${to}: ${subject}`);
          return { success: true, provider: 'gmail-fallback', id: result.messageId };
        } catch (gmailError) {
          console.error(`❌ Gmail fallback also failed:`, gmailError.message);
        }
      }

      return { success: false, error: error.message };
    }
  }

  // OTP Email Templates
  async sendOTPEmail(email, otp, purpose = 'verification') {
    const subject = `Your ${config.app.name} OTP Code`;
    const html = this.generateOTPEmailHTML(otp, purpose);
    return this.sendEmail({ to: email, subject, html });
  }

  // Order Email Templates
  async sendOrderConfirmationEmail(order, customer) {
    const subject = `Order Confirmation - ${order.orderNumber}`;
    const html = this.generateOrderConfirmationHTML(order, customer);
    return this.sendEmail({ to: customer.email, subject, html });
  }

  async sendOrderStatusUpdateEmail(order, customer, newStatus) {
    const subject = `Order Update - ${order.orderNumber}`;
    const html = this.generateOrderStatusHTML(order, customer, newStatus);
    return this.sendEmail({ to: customer.email, subject, html });
  }

  async sendDeliveryAssignedEmail(order, customer, deliveryAgent) {
    const subject = `Your order is out for delivery - ${order.orderNumber}`;
    const html = this.generateDeliveryAssignedHTML(order, customer, deliveryAgent);
    return this.sendEmail({ to: customer.email, subject, html });
  }

  // Email Template Generators
  generateOTPEmailHTML(otp, purpose) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>OTP Verification</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
          .header { text-align: center; color: #2196F3; margin-bottom: 30px; }
          .otp-box { background: #fff; padding: 20px; text-align: center; border-radius: 8px; border: 2px dashed #2196F3; margin: 20px 0; }
          .otp-code { font-size: 36px; font-weight: bold; color: #2196F3; letter-spacing: 8px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${config.app.name}</h1>
            <h2>Email Verification</h2>
          </div>
          
          <p>Hi there!</p>
          <p>Your OTP code for ${purpose} is:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you didn't request this code, please ignore this email.</p>
          
          <div class="footer">
            <p>This is an automated email from ${config.app.name}</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateOrderConfirmationHTML(order, customer) {
    const itemsList = order.items?.map(item => 
      `<tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.medicine?.name || item.product?.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.total}</td>
      </tr>`
    ).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
          .header { text-align: center; color: #4CAF50; margin-bottom: 30px; }
          .order-info { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .order-table th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
          .total-row { background: #f9f9f9; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${config.app.name}</h1>
            <h2>✅ Order Confirmed!</h2>
          </div>
          
          <div class="order-info">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Customer:</strong> ${customer.firstName} ${customer.lastName}</p>
            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
          </div>

          <table class="order-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
              <tr class="total-row">
                <td colspan="3" style="padding: 15px; text-align: right;">Subtotal:</td>
                <td style="padding: 15px; text-align: right;">₹${order.subtotal || 0}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" style="padding: 15px; text-align: right;">Delivery Charges:</td>
                <td style="padding: 15px; text-align: right;">₹${order.deliveryCharges || 0}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" style="padding: 15px; text-align: right;">Tax:</td>
                <td style="padding: 15px; text-align: right;">₹${order.tax || 0}</td>
              </tr>
              <tr class="total-row" style="border-top: 2px solid #4CAF50;">
                <td colspan="3" style="padding: 15px; text-align: right; font-size: 18px;">Total Amount:</td>
                <td style="padding: 15px; text-align: right; font-size: 18px; color: #4CAF50;">₹${order.totalAmount}</td>
              </tr>
            </tbody>
          </table>

          ${order.deliveryAddress ? `
          <div class="order-info">
            <h3>Delivery Address</h3>
            <p>${order.deliveryAddress.street}<br>
            ${order.deliveryAddress.city}, ${order.deliveryAddress.state}<br>
            ${order.deliveryAddress.zipCode}<br>
            Phone: ${order.deliveryAddress.phone}</p>
          </div>
          ` : ''}

          <p>Thank you for your order! We'll send you updates as your order progresses.</p>
          
          <div class="footer">
            <p>This is an automated email from ${config.app.name}</p>
            <p>For any queries, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateOrderStatusHTML(order, customer, newStatus) {
    const statusMessages = {
      'confirmed': 'Your order has been confirmed and is being prepared.',
      'processing': 'Your order is being processed by our pharmacy.',
      'out_for_delivery': 'Your order is out for delivery!',
      'delivered': 'Your order has been delivered successfully.',
      'cancelled': 'Your order has been cancelled.'
    };

    const statusColors = {
      'confirmed': '#2196F3',
      'processing': '#FF9800', 
      'out_for_delivery': '#9C27B0',
      'delivered': '#4CAF50',
      'cancelled': '#F44336'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Status Update</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
          .header { text-align: center; margin-bottom: 30px; }
          .status-box { background: #fff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border-left: 5px solid ${statusColors[newStatus] || '#666'}; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${config.app.name}</h1>
            <h2>Order Status Update</h2>
          </div>
          
          <p>Hi ${customer.firstName},</p>
          
          <div class="status-box">
            <h3 style="color: ${statusColors[newStatus] || '#666'}; margin: 0;">
              Order ${order.orderNumber}
            </h3>
            <p style="font-size: 18px; margin: 10px 0;">${statusMessages[newStatus] || 'Order status updated.'}</p>
            <p style="font-weight: bold; color: ${statusColors[newStatus] || '#666'};">
              Status: ${newStatus.toUpperCase().replace('_', ' ')}
            </p>
          </div>
          
          <p>Order Total: <strong>₹${order.totalAmount}</strong></p>
          
          <div class="footer">
            <p>Thank you for choosing ${config.app.name}</p>
            <p>Track your order in the mobile app for real-time updates.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateDeliveryAssignedHTML(order, customer, deliveryAgent) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Out for Delivery</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
          .header { text-align: center; color: #9C27B0; margin-bottom: 30px; }
          .delivery-info { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #9C27B0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${config.app.name}</h1>
            <h2>🚚 Out for Delivery!</h2>
          </div>
          
          <p>Hi ${customer.firstName},</p>
          <p>Great news! Your order <strong>${order.orderNumber}</strong> is now out for delivery.</p>
          
          <div class="delivery-info">
            <h3>Delivery Agent Details</h3>
            <p><strong>Name:</strong> ${deliveryAgent.firstName} ${deliveryAgent.lastName}</p>
            <p><strong>Phone:</strong> ${deliveryAgent.phone}</p>
            <p><strong>Vehicle:</strong> ${deliveryAgent.vehicleType} (${deliveryAgent.vehicleNumber})</p>
          </div>
          
          <p>Your delivery agent will contact you shortly for the delivery.</p>
          <p><strong>Order Total:</strong> ₹${order.totalAmount}</p>
          
          <div class="footer">
            <p>Please keep your phone handy for delivery coordination.</p>
            <p>Thank you for choosing ${config.app.name}!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Utility function to strip HTML tags
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();
