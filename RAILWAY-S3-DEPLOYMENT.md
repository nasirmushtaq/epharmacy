# Railway Deployment with S3 Integration

## 🚀 **Railway Environment Variables Setup**

### **Required Environment Variables for Railway:**

```bash
# Node.js Configuration
NODE_ENV=production
PORT=8080

# Database
MONGODB_URI=mongodb+srv://adilbhat4422:QMNZg1nMjwxEpjcR@cluster0.khqdhcg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# Authentication
JWT_SECRET=your-production-jwt-secret-here
OTP_DUMMY_CODE=123456
OTP_TTL_MIN=10

# Backend Configuration
BACKEND_URL=https://epharmacy-production.up.railway.app
CORS_ALLOW_ALL=true

# Admin accounts must be created manually via registration

# AWS S3 Configuration (NEW)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=epharmacy-prescriptions-790813558024

# Cashfree Payment Gateway
CASHFREE_APP_ID=TEST107538751647faec42463670bb6b57835701
CASHFREE_SECRET_KEY=your-cashfree-secret-key
CASHFREE_ENVIRONMENT=SANDBOX
```

## 📋 **Deployment Steps:**

### **1. Set Environment Variables in Railway:**
1. Go to Railway dashboard → Your project
2. Click **"Variables"** tab
3. Add each environment variable above
4. **Important**: Use your actual AWS credentials (not placeholder values)

### **2. Verify S3 Integration:**
After deployment, check Railway logs for:
```
✅ AWS S3 client initialized
MongoDB connected successfully
Server running on port 8080 in production mode
```

### **3. Test S3 Functionality:**
```bash
# Test prescription upload endpoint
curl -X POST https://epharmacy-production.up.railway.app/api/prescriptions \
  -H "Authorization: Bearer your-jwt-token" \
  -F "documents=@prescription.pdf" \
  -F "doctorName=Dr. Test" \
  -F "doctorRegistrationNumber=TEST123" \
  -F "patientName=Test Patient" \
  -F "patientAge=30" \
  -F "patientGender=male" \
  -F "prescriptionDate=2025-01-15" \
  -F "validUntil=2025-02-15"
```

### **4. Mobile App Configuration:**
✅ **Already configured** - `app.json` points to Railway:
```json
{
  "extra": {
    "apiBaseUrl": "https://epharmacy-production.up.railway.app"
  }
}
```

## 🔧 **S3 Features in Production:**

### **Prescription Upload Flow:**
1. **Customer uploads** prescription via mobile app
2. **Files go to S3** bucket `epharmacy-prescriptions-790813558024`
3. **Database stores** S3 key + metadata
4. **Pharmacist views** files via signed URLs (1-hour expiry)

### **Security Features:**
- 🔒 **Private S3 bucket** (no public access)
- 🔐 **Server-side encryption** (AES-256)
- 🔗 **Signed URLs** with automatic expiry
- 🛡️ **IAM permissions** limited to specific bucket
- 📋 **Audit trail** in application logs

### **Fallback Behavior:**
If S3 credentials are missing or invalid:
- ⚠️ **Logs warning**: "AWS credentials not found, S3 uploads disabled"
- 📁 **Falls back** to local file storage
- 🔄 **No service interruption** for users

## 🔍 **Monitoring & Troubleshooting:**

### **Check S3 Integration:**
1. **Railway Logs**: Look for S3 initialization messages
2. **AWS S3 Console**: Verify files are being uploaded
3. **Application Logs**: Monitor upload/download success rates

### **Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| "S3 uploads disabled" | Missing AWS credentials | Set AWS_* environment variables |
| "Access denied" | Wrong IAM permissions | Update IAM policy for bucket access |
| "Bucket not found" | Wrong bucket name | Verify AWS_S3_BUCKET_NAME |
| "Invalid region" | Wrong AWS region | Set AWS_REGION=ap-south-1 |

### **Health Check Endpoints:**
```bash
# Basic health check
curl https://epharmacy-production.up.railway.app/api/auth/me

# Test user registration
curl -X POST https://epharmacy-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","firstName":"Test","lastName":"User","role":"customer"}'
```

## 📊 **Monitoring S3 Usage:**

### **AWS CloudWatch Metrics:**
- **Storage usage**: Monitor bucket size growth
- **Request counts**: GET/PUT operations
- **Error rates**: Failed uploads/downloads
- **Cost monitoring**: Set billing alerts

### **Application Metrics:**
- **Upload success rate**: Track failed uploads
- **File access patterns**: Monitor signed URL usage
- **Performance**: Upload/download times

## 🚨 **Production Checklist:**

- ✅ **Environment variables** set in Railway
- ✅ **S3 bucket** created with proper permissions
- ✅ **IAM user** has minimal required permissions
- ✅ **MongoDB** connection working
- ✅ **User registration** working
- ✅ **Mobile app** pointing to Railway
- ✅ **Prescription upload** tested end-to-end
- ✅ **Pharmacist document** viewing tested
- ✅ **CloudWatch alerts** configured (optional)

## 🔄 **Backup & Recovery:**

### **S3 Backup Strategy:**
- ✅ **Versioning enabled** on S3 bucket
- ✅ **Cross-region replication** (optional)
- ✅ **Lifecycle policies** for cost optimization
- ✅ **Regular backups** to alternative storage

**Your S3-integrated ePharmacy backend is now production-ready!** 🎉
