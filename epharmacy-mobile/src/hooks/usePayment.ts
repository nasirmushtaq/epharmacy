import { useState } from 'react';
import api from '../services/api';

interface PaymentContext {
  sessionId: string;
  appId: string;
  env: string;
  amount: number;
  orderId: string;
}

interface UsePaymentOptions {
  onSuccess?: (data: { orderId: string; paymentId: string; signature: string }) => void;
  onFailure?: (message: string) => void;
}

export const usePayment = (options: UsePaymentOptions = {}) => {
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentContext, setPaymentContext] = useState<PaymentContext | null>(null);

  const createPaymentSession = async (amount: number, orderId: string) => {
    try {
      const cfRes = await api.post('/api/payments/cashfree/create', {
        amount,
        orderId,
        currency: 'INR'
      });

      const { sessionId, appId, env } = cfRes.data?.data || {};
      
      if (!sessionId || !appId) {
        throw new Error('Payment initialization failed');
      }

      const context = {
        sessionId,
        appId,
        env: env || 'SANDBOX',
        amount,
        orderId
      };

      setPaymentContext(context);
      setPaymentVisible(true);
      
      return context;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Payment initialization failed');
    }
  };

  const handlePaymentSuccess = async ({ orderId, paymentId, signature }: any) => {
    try {
      // Verify payment if signature is provided (Razorpay)
      if (signature) {
        await api.post('/api/payments/verify', {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        });
      }

      setPaymentVisible(false);
      setPaymentContext(null);
      
      if (options.onSuccess) {
        options.onSuccess({ orderId, paymentId, signature });
      }
      
    } catch (error: any) {
      setPaymentVisible(false);
      setPaymentContext(null);
      
      if (options.onFailure) {
        options.onFailure('Payment successful but verification failed');
      }
    }
  };

  const handlePaymentFailure = (message: string) => {
    setPaymentVisible(false);
    setPaymentContext(null);
    
    if (options.onFailure) {
      options.onFailure(message);
    }
  };

  const closePayment = () => {
    setPaymentVisible(false);
    setPaymentContext(null);
  };

  return {
    paymentVisible,
    paymentContext,
    createPaymentSession,
    handlePaymentSuccess,
    handlePaymentFailure,
    closePayment
  };
}; 