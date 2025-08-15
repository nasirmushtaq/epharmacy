# Environment Management for ePharmacy Project

This document explains how to manage different environments (local development, production) for the ePharmacy project.

## Files Created

### 1. `environments.local` 
**Location**: `~/epharmacy-config/environments.local` (outside project)  
**Purpose**: Contains all environment-specific configuration  
**Git Status**: ❌ Never committed (outside project directory)

Contains:
- Backend URLs (local, Railway)
- Database connection strings
- Authentication credentials
- Payment gateway settings
- Development tools configuration
- Quick command references

### 2. `scripts/switch-env.sh`
**Location**: `scripts/switch-env.sh`  
**Purpose**: Quick script to switch between environments  
**Git Status**: ✅ Committed to git

## Usage

### Quick Environment Switch

```bash
# Switch to local development
./scripts/switch-env.sh local

# Switch to Railway production
./scripts/switch-env.sh railway

# Check current environment
./scripts/switch-env.sh status
```

### Manual Environment Management

#### Switch to Local Development:
1. Edit `epharmacy-mobile/app.json`:
   ```json
   "apiBaseUrl": "http://localhost:8000"
   ```
2. Start local backend:
   ```bash
   cd backend && PORT=8000 NODE_ENV=development npm start
   ```
3. Rebuild mobile app:
   ```bash
   cd epharmacy-mobile && npm run android
   ```

#### Switch to Railway Production:
1. Edit `epharmacy-mobile/app.json`:
   ```json
   "apiBaseUrl": "https://epharmacy-production.up.railway.app"
   ```
2. Rebuild mobile app:
   ```bash
   cd epharmacy-mobile && npm run android
   ```

## Environment Variables Reference

### Backend Environment Variables

| Variable | Local | Railway |
|----------|-------|---------|
| `PORT` | 8000 | 8080 |
| `NODE_ENV` | development | production |
| `MONGODB_URI` | mongodb://localhost:27017/epharmacy | MongoDB Atlas URI |
| `JWT_SECRET` | Set in environments.local | Set in Railway dashboard |
| `CASHFREE_APP_ID` | Test credentials | Production credentials |

### Mobile App Configuration

The mobile app reads the API URL from `app.json` → `extra.apiBaseUrl`:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://localhost:8000"  // or Railway URL
    }
  }
}
```

## Development Workflow

### Local Development Workflow:
1. `./scripts/switch-env.sh local`
2. Start MongoDB: `mongod`
3. Start backend: `cd backend && npm start`
4. Start mobile: `cd epharmacy-mobile && npm run android`
5. Test on emulator with `adb reverse tcp:8000 tcp:8000`

### Production Release Workflow:
1. `./scripts/switch-env.sh railway`
2. Test Railway connectivity: `curl https://epharmacy-production.up.railway.app/api/products`
3. Build release: `cd epharmacy-mobile/android && ./gradlew assembleRelease`
4. Create GitHub release: `gh release create v1.x.x app-universal-release.apk`

## Security Notes

- ❌ **Never commit** `environments.local` to git
- ✅ **Always verify** .gitignore includes `environments.local`
- 🔐 **Keep sensitive data** (passwords, tokens) secure
- 🚀 **Use environment variables** in production (Railway dashboard)

## Troubleshooting

### Common Issues:

1. **"Network Error" on mobile app**
   - Check `app.json` has correct `apiBaseUrl`
   - For emulator: Run `adb reverse tcp:8000 tcp:8000`
   - For device: Ensure backend is accessible over network

2. **Backend won't start locally**
   - Check MongoDB is running: `mongod`
   - Verify port 8000 is free: `lsof -ti:8000`
   - Check environment variables in `~/epharmacy-config/environments.local`

3. **Railway deployment issues**
   - Verify environment variables in Railway dashboard
   - Check MongoDB Atlas IP whitelist
   - Test API: `curl https://epharmacy-production.up.railway.app/api/products`

## File Locations

```
~/epharmacy-config/
└── environments.local          # ❌ Outside project - your local config

epharmacy-project/
├── scripts/switch-env.sh       # ✅ In git - environment switcher
├── .gitignore                  # ✅ In git - general ignore rules
├── backend/
│   ├── server.js              # Reads environment variables
│   └── .env                   # ❌ Not in git - backend-specific env
├── epharmacy-mobile/
│   ├── app.json               # ✅ In git - contains apiBaseUrl
│   └── src/services/api.ts    # Reads apiBaseUrl from app.json
└── README-environments.md     # ✅ In git - this documentation
```
