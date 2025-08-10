// Global type declarations for React Native app

declare var __DEV__: boolean;

// User types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'customer' | 'pharmacist' | 'delivery_agent' | 'admin';
  isEmailVerified: boolean;
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
}

// Cart types
export interface CartItem {
  medicineId: string;
  name: string;
  brand: string;
  price: number;
  mrp: number;
  quantity: number;
  maxQuantity: number;
  isPrescriptionRequired: boolean;
  image?: string;
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
    total: number;
  }>;
  status: 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  totalAmount: number;
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
  doctorInfo: {
    name: string;
    registrationNumber: string;
  };
  patientInfo: {
    name: string;
    age: number;
    gender: string;
  };
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired';
  prescriptionDate: string;
  validUntil: string;
  documents: Array<{
    url: string;
    originalName: string;
  }>;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
  }>;
  notes: string;
  createdAt: string;
  updatedAt: string;
} 