import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Modal, View, StyleSheet, Platform, ActivityIndicator, Linking } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import Cashfree SDK only on native platforms
let PGSDK: any = undefined;
if (Platform.OS !== 'web') {
  try {
    PGSDK = require('react-native-cashfree-pg-sdk').PGSDK;
  } catch (error) {
    // SDK not available, will fallback to WebView
  }
}

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  mode?: 'razorpay' | 'cashfree';
  // Razorpay
  keyId?: string;
  orderId?: string;
  amount?: number | string;
  currency?: string;
  title?: string;
  description?: string;
  headers?: Record<string, string>;
  onSuccess: (payload: { orderId: string; paymentId: string; signature: string }) => void;
  onFailure?: (message: string) => void;
  // Cashfree
  sessionId?: string;
  appId?: string;
  env?: 'TEST' | 'SANDBOX' | 'PROD' | 'production' | 'development';
}

const PaymentModal: React.FC<PaymentModalProps> = ({ 
  visible, 
  onClose, 
  apiBaseUrl, 
  mode = 'cashfree', 
  keyId, 
  orderId, 
  amount, 
  currency = 'INR', 
  title = 'Payment', 
  description = 'Checkout', 
  headers, 
  onSuccess, 
  onFailure, 
  sessionId, 
  appId, 
  env = 'SANDBOX' 
}) => {
  const uri = useMemo(() => {
    const base = apiBaseUrl.replace(/\/$/, '');
    if (mode === 'razorpay') {
      return `${base}/checkout-page?keyId=${keyId}&orderId=${orderId}&amount=${amount}&currency=${currency}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
    } else {
      return `${base}/api/payments/cashfree/checkout-page?sessionId=${sessionId}&appId=${appId}&env=${env}`;
    }
  }, [apiBaseUrl, mode, keyId, orderId, amount, currency, title, description, sessionId, appId, env]);

  const [reloadKey, setReloadKey] = useState(0);
  const retriedRef = useRef(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Try to use native Cashfree SDK if available
    if (visible && mode === 'cashfree' && PGSDK && sessionId) {
      try {
        const payload = {
          orderId: orderId || '',
          paymentSessionId: sessionId,
          environment: (env === 'PROD' || env === 'production') ? 'PROD' : 'SANDBOX'
        } as any;
        
        const maybePromise = PGSDK.doPayment(JSON.stringify(payload));
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then((result: string) => {
            try {
              const data = typeof result === 'string' ? JSON.parse(result) : (result || {});
              const status = (data.txStatus || data.status || '').toUpperCase();
              const paid = status === 'SUCCESS' || status === 'PAID';
              if (paid) {
                onSuccess && onSuccess({ 
                  orderId: data.orderId || payload.orderId || '', 
                  paymentId: data.referenceId || data.cf_payment_id || '', 
                  signature: '' 
                });
              } else {
                onFailure && onFailure(data.txMsg || 'Payment failed or cancelled');
              }
            } catch (e: any) {
              onFailure && onFailure(e?.message || 'Payment parse error');
            } finally {
              onClose && onClose();
            }
          }).catch((e: any) => {
            onFailure && onFailure(e?.message || 'Payment error');
            onClose && onClose();
          });
        }
      } catch (e) {
        // Fallback to WebView if native SDK fails
      }
    }
  }, [visible, mode, sessionId, env, orderId]);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) setAuthHeaders({ Authorization: `Bearer ${token}` });
      } catch {}
    })();
  }, []);

  const onMessage = (event: any) => {
    try {
      const rawData = event?.nativeEvent?.data;
      if (!rawData) return;
      
      let data;
      if (typeof rawData === 'string') {
        data = JSON.parse(rawData);
      } else if (typeof rawData === 'object') {
        data = rawData;
      } else {
        return;
      }
      
      if (data.event === 'success') {
        const successData = {
          orderId: data.data?.orderId || orderId || '',
          paymentId: data.data?.paymentId || data.data?.cf_payment_id || '',
          signature: data.data?.signature || ''
        };
        onSuccess && onSuccess(successData);
      } else if (data.event === 'failed') {
        const errorMsg = data.data?.error || 'Payment failed';
        onFailure && onFailure(errorMsg);
      } else if (data.event === 'dismiss') {
        onClose && onClose();
      }
    } catch (e) {
      const error = e as Error;
      onFailure && onFailure(`Message parse error: ${error.message}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text variant="titleMedium">{title}</Text>
            <Button onPress={onClose}>Close</Button>
          </View>
                  
          {errorMessage && (
            <View style={{ backgroundColor: '#ffebee', padding: 12, margin: 10, borderRadius: 8 }}>
              <Text style={{ color: '#c62828', fontWeight: 'bold' }}>Payment Error:</Text>
              <Text style={{ color: '#c62828', marginTop: 4 }}>{errorMessage}</Text>
              <Button mode="outlined" onPress={() => setErrorMessage(null)} style={{ marginTop: 8 }}>
                Try Again
              </Button>
            </View>
          )}
          
          {mode === 'cashfree' && PGSDK ? (
            <View style={styles.loading}><ActivityIndicator /></View>
          ) : (
            <WebView
              key={reloadKey}
              source={{ uri, headers: { ...(headers || {}), ...authHeaders } }}
              style={{ flex: 1 }}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setSupportMultipleWindows
              allowsInlineMediaPlayback
              onMessage={onMessage}
              onError={(e) => {
                if (!retriedRef.current) { 
                  retriedRef.current = true; 
                  setTimeout(() => setReloadKey((k) => k + 1), 800); 
                  return; 
                }
                onFailure && onFailure('Unable to load payment page');
              }}
              onHttpError={(e) => { 
                onFailure && onFailure('Payment page HTTP error'); 
              }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loading}><ActivityIndicator /></View>
              )}
            />
          )}
          
          <View style={{ padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' }}>
            <Button mode="text" onPress={() => Linking.openURL(uri)}>Open in browser</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { height: '80%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default PaymentModal; 