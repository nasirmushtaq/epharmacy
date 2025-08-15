# AWS S3 Setup Guide for ePharmacy Prescription Storage

## Overview

This guide walks you through setting up AWS S3 for secure prescription file storage in your ePharmacy application.

## ✅ What's Been Implemented

### Backend Changes:
- ✅ AWS SDK v3 integration (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- ✅ S3 configuration module (`backend/config/s3.js`)
- ✅ Prescription upload route updated to use S3
- ✅ Signed URL generation for secure file access
- ✅ Fallback to local storage if S3 not configured

### Mobile App Changes:
- ✅ Updated prescription viewing to fetch signed URLs
- ✅ Secure document access through API endpoints
- ✅ Support for both S3 and local file storage

### Features:
- 🔐 **Secure Storage**: Files stored privately in S3
- 🔗 **Signed URLs**: Temporary access URLs (1 hour expiry)
- 📱 **Mobile Optimized**: Seamless document viewing
- 🔄 **Backward Compatible**: Works with existing local files
- 🛡️ **Encrypted**: Server-side encryption (AES256)

## 🚀 AWS Setup Steps

### Step 1: Create AWS Account & IAM User

1. **Create AWS Account** (if you don't have one):
   - Go to https://aws.amazon.com/
   - Sign up for free tier

2. **Create IAM User for S3 Access**:
   ```bash
   # Go to AWS Console → IAM → Users → Create User
   # User name: epharmacy-s3-user
   # Access type: Programmatic access
   ```

3. **Create IAM Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:GetObjectVersion"
         ],
         "Resource": "arn:aws:s3:::epharmacy-prescriptions/*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "s3:ListBucket",
           "s3:GetBucketLocation"
         ],
         "Resource": "arn:aws:s3:::epharmacy-prescriptions"
       }
     ]
   }
   ```

4. **Attach Policy to User**:
   - Attach the policy created above
   - Save **Access Key ID** and **Secret Access Key**

### Step 2: Create S3 Bucket

1. **Create Bucket**:
   ```bash
   # Go to AWS Console → S3 → Create Bucket
   # Bucket name: epharmacy-prescriptions (must be globally unique)
   # Region: us-east-1 (or your preferred region)
   ```

2. **Configure Bucket Settings**:
   - ❌ **Block all public access** (keep it private)
   - ✅ **Bucket Versioning**: Enable
   - ✅ **Server-side encryption**: Enable (AES-256)
   - ✅ **Object Lock**: Disabled (not needed)

3. **Set Lifecycle Policy** (Optional):
   ```json
   {
     "Rules": [
       {
         "ID": "DeleteOldVersions",
         "Status": "Enabled",
         "Transitions": [
           {
             "Days": 30,
             "StorageClass": "STANDARD_IA"
           },
           {
             "Days": 90,
             "StorageClass": "GLACIER"
           }
         ],
         "NoncurrentVersionTransitions": [
           {
             "NoncurrentDays": 30,
             "StorageClass": "STANDARD_IA"
           }
         ],
         "NoncurrentVersionExpiration": {
           "NoncurrentDays": 365
         }
       }
     ]
   }
   ```

### Step 3: Configure Environment Variables

#### For Local Development:

Update `~/epharmacy-config/environments.local`:
```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=epharmacy-prescriptions
```

#### For Railway Production:

Set environment variables in Railway dashboard:
```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=epharmacy-prescriptions
```

### Step 4: Test S3 Integration

#### Start Backend with S3:
```bash
cd backend
AWS_ACCESS_KEY_ID=your-key AWS_SECRET_ACCESS_KEY=your-secret AWS_S3_BUCKET_NAME=epharmacy-prescriptions npm start
```

#### Check Logs:
```bash
# Should see:
✅ AWS S3 client initialized

# If credentials missing:
⚠️  AWS credentials not found, S3 uploads disabled
```

#### Test Upload:
1. Open mobile app
2. Upload a prescription
3. Check backend logs for S3 upload confirmation
4. Verify file appears in S3 bucket

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | - | AWS secret key |
| `AWS_REGION` | No | us-east-1 | S3 region |
| `AWS_S3_BUCKET_NAME` | Yes | - | S3 bucket name |

### Backend Configuration

The backend automatically:
- ✅ **Falls back to local storage** if S3 not configured
- ✅ **Validates credentials** on startup
- ✅ **Generates signed URLs** for secure access
- ✅ **Handles errors gracefully**

## 📊 Cost Estimation

### AWS S3 Pricing (Free Tier):
- **Storage**: 5 GB free for 12 months
- **Requests**: 20,000 GET, 2,000 PUT/COPY/POST/LIST
- **Data Transfer**: 15 GB out per month

### Typical Usage:
- **Prescription file**: ~500KB - 2MB each
- **Monthly uploads**: ~1000 prescriptions = ~1GB storage
- **Access requests**: ~5000 GET requests/month
- **Estimated cost**: $0.02 - $0.05/month after free tier

## 🛡️ Security Features

### File Security:
- 🔒 **Private bucket** (no public access)
- 🔗 **Signed URLs** (temporary access)
- 🔐 **Server-side encryption** (AES-256)
- 🛡️ **IAM policies** (minimal permissions)

### Access Control:
- ✅ **Authentication required** for all file access
- ✅ **Role-based access** (customer, pharmacist, admin)
- ✅ **Audit logging** via CloudTrail
- ✅ **Automatic URL expiry** (1 hour)

## 🚨 Troubleshooting

### Common Issues:

1. **"S3 not configured" error**:
   ```bash
   # Check environment variables
   echo $AWS_ACCESS_KEY_ID
   echo $AWS_S3_BUCKET_NAME
   ```

2. **"Access denied" errors**:
   - Verify IAM user has correct permissions
   - Check bucket name is correct
   - Ensure bucket region matches `AWS_REGION`

3. **"Failed to upload" errors**:
   - Check internet connectivity
   - Verify AWS credentials are valid
   - Check bucket exists and is accessible

4. **"Failed to generate download URL"**:
   - Verify file exists in S3
   - Check IAM permissions for GetObject
   - Ensure bucket and region are correct

### Debug Mode:
```bash
# Enable debug logging
DEBUG=aws-sdk npm start
```

## 📈 Monitoring

### CloudWatch Metrics:
- Monitor S3 request counts
- Track storage usage
- Set up billing alerts

### Application Logs:
```bash
# Search for S3-related logs
grep "S3\|AWS" backend/logs/*.log

# Monitor upload success/failure
grep "Uploaded\|Failed to upload" backend/logs/*.log
```

## 🔄 Migration from Local Storage

If you have existing prescriptions stored locally:

1. **Create migration script** to upload existing files to S3
2. **Update database** with S3 keys
3. **Keep local files** as backup during transition
4. **Test thoroughly** before removing local files

The current implementation supports both storage types simultaneously, so migration can be gradual.

## ✅ Next Steps

1. **Set up AWS account and S3 bucket**
2. **Configure environment variables**
3. **Test prescription upload flow**
4. **Monitor S3 usage and costs**
5. **Set up CloudWatch alerts**
6. **Plan data backup strategy**

This implementation provides a production-ready, secure, and scalable solution for prescription file storage! 🎉
