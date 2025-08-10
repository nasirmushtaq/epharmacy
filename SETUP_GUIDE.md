# E-Pharmacy Application Setup Guide

This guide will help you set up and run the complete e-pharmacy application with both backend and frontend.

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Git

## Project Structure

```
e-pharmacy/
├── backend/          # Express.js API server
├── frontend/         # React.js application
├── README.md
└── SETUP_GUIDE.md
```

## Quick Start

### 1. Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env` file in the backend directory:
   ```bash
   cp config/env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/epharmacy
   
   # JWT
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   JWT_EXPIRE=7d
   
   # Email Configuration (optional for development)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM=no-reply@epharmacy.com
   
   # File Upload
   MAX_FILE_SIZE=5242880
   UPLOAD_PATH=./uploads
   
   # URLs
   FRONTEND_URL=http://localhost:3000
   BACKEND_URL=http://localhost:5000
   ```

4. **Start MongoDB:**
   - **Local MongoDB:** `mongod`
   - **MongoDB Atlas:** Ensure your connection string is in MONGODB_URI

5. **Start the backend server:**
   ```bash
   npm run dev
   ```
   
   The backend will be running at `http://localhost:5000`

### 2. Frontend Setup

1. **Open a new terminal and navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the frontend application:**
   ```bash
   npm start
   ```
   
   The frontend will be running at `http://localhost:3000`

## Application Features

### User Roles & Capabilities

#### 1. **Customer**
- Register and login
- Browse medicines catalog
- Upload prescriptions
- Place orders (with/without prescription)
- Track order status
- Manage profile

#### 2. **Pharmacist**
- Review and approve prescriptions
- Manage medicine inventory
- Process orders
- View analytics

#### 3. **Delivery Agent**
- Register with vehicle details
- View assigned deliveries
- Update delivery status
- Upload delivery proof

#### 4. **Admin**
- User management
- System analytics
- Inventory oversight
- Order management

### Key Features

- **Authentication & Authorization:** JWT-based with role-based access control
- **Prescription Management:** Upload, review, and approval workflow
- **Medicine Catalog:** Search, filter, and browse medicines
- **Order Management:** Complete order lifecycle from placement to delivery
- **Real-time Tracking:** Order and delivery status updates
- **File Upload:** Prescription images and delivery proof
- **Responsive Design:** Works on desktop and mobile devices

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Medicines
- `GET /api/medicines` - Get medicines with filters
- `GET /api/medicines/:id` - Get single medicine
- `POST /api/medicines` - Create medicine (Pharmacist)
- `PUT /api/medicines/:id` - Update medicine (Pharmacist)

### Prescriptions
- `POST /api/prescriptions` - Upload prescription (Customer)
- `GET /api/prescriptions/pending-reviews` - Get pending prescriptions (Pharmacist)
- `PATCH /api/prescriptions/:id/approve` - Approve prescription (Pharmacist)

### Orders
- `POST /api/orders` - Create order (Customer)
- `GET /api/orders/my-orders` - Get user orders (Customer)
- `PATCH /api/orders/:id/status` - Update order status (Pharmacist)

### Deliveries
- `POST /api/deliveries/assign` - Assign delivery (Pharmacist)
- `GET /api/deliveries/my-deliveries` - Get agent deliveries (Delivery Agent)
- `PATCH /api/deliveries/:id/status` - Update delivery status (Delivery Agent)

## Database Schema

The application uses MongoDB with the following main collections:
- **users** - All user types with role-based fields
- **medicines** - Medicine catalog with inventory management
- **prescriptions** - Prescription uploads and approval workflow
- **orders** - Order management and tracking
- **deliveries** - Delivery assignments and tracking

## Development Workflow

### Adding New Features

1. **Backend:**
   - Add routes in `backend/routes/`
   - Create/update models in `backend/models/`
   - Add middleware if needed in `backend/middleware/`

2. **Frontend:**
   - Create components in `frontend/src/components/`
   - Add pages in `frontend/src/pages/`
   - Update routing in `frontend/src/App.js`

### Testing

- **Backend:** `cd backend && npm test`
- **Frontend:** `cd frontend && npm test`

## Production Deployment

### Backend Deployment
1. Set `NODE_ENV=production`
2. Use MongoDB Atlas for database
3. Configure proper JWT secrets
4. Set up email service (SendGrid, etc.)
5. Configure file storage (AWS S3, etc.)

### Frontend Deployment
1. Build the app: `npm run build`
2. Deploy to hosting service (Netlify, Vercel, etc.)
3. Update API URL to production backend

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error:**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file

2. **CORS Issues:**
   - Verify FRONTEND_URL in backend .env
   - Check proxy setting in frontend package.json

3. **File Upload Issues:**
   - Check MAX_FILE_SIZE setting
   - Ensure uploads directory exists and has write permissions

4. **Authentication Issues:**
   - Verify JWT_SECRET is set
   - Check token storage in browser

### Getting Help

- Check the console for error messages
- Verify environment variables
- Ensure all dependencies are installed
- Check database connection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

---

**Happy Coding! 🚀**

For any issues or questions, please check the troubleshooting section or create an issue in the repository. 