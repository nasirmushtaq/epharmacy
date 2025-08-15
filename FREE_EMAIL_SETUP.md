# 📧 Free Email Service Setup Guide

This guide shows you how to set up **free email services** for sending OTP and order emails in your ePharmacy app.

## 🎯 Available Free Options

### Option 1: Resend (Recommended)
- **Free Tier:** 3,000 emails/month
- **Easy Setup:** Modern API, great documentation
- **Deliverability:** Excellent reputation

### Option 2: Gmail SMTP (Fallback)
- **Free Tier:** Unlimited for personal use
- **Setup:** Requires App Password
- **Deliverability:** Good, but may be limited for bulk

---

## 🚀 Option 1: Resend Setup (Recommended)

### Step 1: Create Resend Account
1. Visit [resend.com](https://resend.com)
2. Sign up with your email
3. Verify your email address

### Step 2: Get API Key
1. Go to your [Resend Dashboard](https://resend.com/api-keys)
2. Click "Create API Key"
3. Name it "ePharmacy" 
4. Copy the API key (starts with `re_`)

### Step 3: Add Domain (Optional)
1. Go to [Domains](https://resend.com/domains)
2. Add your domain (e.g., `yourdomain.com`)
3. Add DNS records as instructed
4. **Or use Resend's domain:** `onboarding.resend.dev` (no setup needed)

### Step 4: Environment Variables
```bash
# Add to your .env file
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@yourdomain.com
# Or use: noreply@onboarding.resend.dev
```

---

## 🔧 Option 2: Gmail SMTP Setup

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Settings](https://myaccount.google.com)
2. Security → 2-Step Verification
3. Turn on 2-Step Verification

### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select app: "Mail" 
3. Select device: "Other" → Enter "ePharmacy"
4. Copy the 16-digit password

### Step 3: Environment Variables
```bash
# Add to your .env file
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-digit-app-password
EMAIL_FROM=your-email@gmail.com
```

---

## ⚙️ Complete Environment Setup

Add these to your `.env` file:

```bash
# Email Configuration
# Primary: Resend (3000 emails/month free)
RESEND_API_KEY=re_your_api_key_here

# Fallback: Gmail SMTP
GMAIL_USER=your-email@gmail.com  
GMAIL_APP_PASSWORD=abcd-efgh-ijkl-mnop

# Email settings
EMAIL_FROM=noreply@yourdomain.com
APP_NAME=ePharmacy
SUPPORT_EMAIL=support@yourdomain.com
```

---

## 🧪 Testing Email Setup

### Test via API:
```bash
# Test OTP Email
curl -X POST http://localhost:8000/api/email/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "type": "otp"}'

# Test Order Email  
curl -X POST http://localhost:8000/api/email/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "type": "order"}'
```

### Check Logs:
```bash
# Backend logs will show:
📧 Email sent via Resend to test@example.com: Your ePharmacy OTP Code
📧 Email sent via Gmail to test@example.com: Order Confirmation - TEST-ORDER-001
```

---

## 🎯 Email Features Included

### ✅ OTP Emails
- **When:** User registration, password reset
- **Content:** Beautiful HTML template with OTP code
- **Expiry:** 10 minutes

### ✅ Order Confirmation Emails  
- **When:** Order placed successfully
- **Content:** Order details, items, total, delivery address
- **Format:** Professional invoice-style

### ✅ Order Status Updates
- **When:** Order status changes (confirmed, processing, delivered)
- **Content:** Status update with tracking info
- **Colors:** Status-specific color coding

### ✅ Delivery Assignment Emails
- **When:** Delivery agent assigned
- **Content:** Agent details, contact info
- **Purpose:** Customer coordination

---

## 📊 Email Limits & Costs

| Service | Free Tier | Paid Plans | Best For |
|---------|-----------|------------|----------|
| **Resend** | 3,000/month | $20/month for 50k | Production apps |
| **Gmail SMTP** | Unlimited* | Free | Development/Personal |
| **SendGrid** | 100/day | $19.95/month | Enterprise |
| **Mailgun** | 1,000/month | $35/month | High volume |

*Gmail SMTP is free but may have sending limits for bulk emails

---

## 🔄 Fallback Strategy

The system automatically falls back:
1. **Try Resend first** (if API key provided)
2. **Fallback to Gmail SMTP** (if configured)  
3. **Log to console** (if no email service configured)

This ensures emails are always sent using the best available service!

---

## 🚨 Troubleshooting

### Resend Issues:
- ✅ Check API key is correct
- ✅ Verify domain ownership
- ✅ Check email address format

### Gmail Issues:
- ✅ Use App Password, not regular password
- ✅ Enable 2-Factor Authentication first
- ✅ Check "Less secure app access" is disabled

### General Issues:
- ✅ Check environment variables are loaded
- ✅ Verify email service initialization in logs
- ✅ Test with simple recipients first

---

## 📱 Production Deployment

For production:
1. Use **Resend** with your own domain
2. Set up **DKIM/SPF** records for better deliverability  
3. Monitor email **bounce rates**
4. Set up **webhook** for delivery status

Your ePharmacy app now has professional email capabilities! 🎉
