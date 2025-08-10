// Global type declarations for React Native app

// User types
export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'customer' | 'pharmacist' | 'delivery_agent' | 'doctor' | 'admin';
  isEmailVerified: boolean;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

// Medicine types
export interface Medicine {
  _id: string;
  name: string;
  brand: string;
  description: string;
  category: string;
  sellingPrice: number;
  mrp: number;
  stockQuantity: number;
  isPrescriptionRequired: boolean;
  images: Array<{
    url: string;
    originalName: string;
  }>;
  isActive: boolean;
  isExpired: boolean;
  isInStock: boolean;
  composition: Array<{
    compound: string;
    strength: string;
  }>;
  expiryDate: string;
  scheduleType: string;
}

// Cart types
export interface CartItem {
  medicine: Medicine;
  quantity: number;
  price: number;
}

// Order types
export interface Order {
  _id: string;
  orderNumber: string;
  customer: string;
  items: Array<{
    medicine: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
  };
  payment: {
    method: string;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Prescription types
export interface Prescription {
  _id: string;
  prescriptionNumber: string;
  customer: string;
  doctorName: string;
  patientName: string;
  patientAge: number;
  patientGender: 'male' | 'female' | 'other';
  diagnosis: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    medicineId?: string;
    isAvailable?: boolean;
  }>;
  documents: Array<{
    filename: string;
    originalName: string;
    url: string;
  }>;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  isVerified: boolean;
  reviewedBy?: string;
  reviewDate?: string;
  reviewNotes?: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Medicines: undefined;
  Cart: undefined;
  Orders: undefined;
  Prescriptions: undefined;
  Profile: undefined;
  PharmacistDashboard: undefined;
  Inventory: undefined;
  PrescriptionReview: undefined;
  OrderManagement: undefined;
  AdminDashboard: undefined;
};

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
} 