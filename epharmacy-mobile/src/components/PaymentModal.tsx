import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Modal, View, StyleSheet, Platform, ActivityIndicator, Linking } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import Cashfree SDK only on native platforms
let PGSDK: any = undefined;
if (Platform.OS !== 'web') {
  try {
    const CashfreeSDK = require('react-native-cashfree-pg-sdk');
    // Try different possible SDK object names
    PGSDK = CashfreeSDK.PGSDK || CashfreeSDK.CFPaymentGatewayService || CashfreeSDK.default;
    console.log('🎯 Cashfree SDK imported successfully:', !!PGSDK);
    console.log('🔍 SDK object keys:', Object.keys(CashfreeSDK || {}));
    console.log('🔍 PGSDK object:', PGSDK);
    console.log('🔍 CFPaymentGatewayService:', CashfreeSDK.CFPaymentGatewayService);
  } catch (error) {
    console.error('❌ Failed to import Cashfree SDK:', error);
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
    // Try to use native Cashfree SDK if available on native platforms
    if (visible && mode === 'cashfree' && PGSDK && sessionId && Platform.OS !== 'web') {
      console.log('🎯 PaymentModal: Attempting native Cashfree SDK payment...');
      console.log('📱 Platform:', Platform.OS);
      console.log('🔑 SessionId:', sessionId);
      console.log('🏪 AppId:', appId);
      console.log('🌍 Environment:', env);
      
      try {
        // Prefer official constructors when available
        const CFModule = require('react-native-cashfree-pg-sdk');
        const ApiContract = require('cashfree-pg-api-contract');

        const CFPaymentGatewayService = CFModule.CFPaymentGatewayService || PGSDK;
        const CFSession = ApiContract.CFSession;
        const CFDropCheckoutPayment = ApiContract.CFDropCheckoutPayment;
        const CFThemeBuilder = ApiContract.CFThemeBuilder;
        const CFEnvironment = ApiContract.CFEnvironment;

        if (CFPaymentGatewayService && CFSession && CFDropCheckoutPayment && CFThemeBuilder && CFEnvironment) {
          const cfEnv = (env === 'PROD' || env === 'production') ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
          const sessionObj = new CFSession(sessionId, (orderId || ''), cfEnv);
          const theme = new CFThemeBuilder()
            .setNavigationBarBackgroundColor('#4f46e5')
            .setNavigationBarTextColor('#ffffff')
            .setButtonBackgroundColor('#4f46e5')
            .setButtonTextColor('#ffffff')
            .setPrimaryTextColor('#111827')
            .setSecondaryTextColor('#6b7280')
            .build();
          const dropPayment = new CFDropCheckoutPayment(sessionObj, null, theme);

          CFPaymentGatewayService.setCallback({
            onVerify: (verifiedOrderId: string) => {
              console.log('✅ Payment SDK Verify:', verifiedOrderId);
              onSuccess && onSuccess({ orderId: verifiedOrderId || (orderId || ''), paymentId: '', signature: '' });
              onClose && onClose();
            },
            onError: (error: any, errOrderId?: string) => {
              try {
                const message = (error && (error.message || error.getMessage?.())) || 'Payment failed';
                console.error('❌ Payment SDK Error:', message, 'order:', errOrderId);
                onFailure && onFailure(message);
              } catch (e: any) {
                onFailure && onFailure(e?.message || 'Payment failed');
              } finally {
                onClose && onClose();
              }
            }
          });

          const timeoutId = setTimeout(() => {
            console.log('⏰ Native SDK timeout - attempting CF WebCheckout via SDK...');
            try {
              CFPaymentGatewayService.doWebPayment(sessionObj);
              console.log('🚀 Invoked CFPaymentGatewayService.doWebPayment(session) as fallback');
            } catch (err) {
              console.log('🔄 CF WebCheckout fallback failed, will use in-app WebView');
            }
          }, 7000);

          console.log('🚀 Calling CFPaymentGatewayService.doWebPayment with session (primary)...');
          try {
            CFPaymentGatewayService.doWebPayment(sessionObj);
            // If SDK web checkout fails to present, try drop checkout
            setTimeout(() => {
              console.log('⏱️ Verifying SDK web checkout presentation...');
            }, 2000);
            setTimeout(() => {
              console.log('⏱️ Checking if payment UI launched...');
            }, 3000);
          } catch (error) {
            console.error('❌ Error calling doWebPayment:', error);
            try {
              console.log('🔁 Trying CF Drop Checkout as secondary...');
              CFPaymentGatewayService.doPayment(dropPayment);
            } catch (e2) {
              clearTimeout(timeoutId);
              console.log('🔄 CF Drop Checkout failed, will use in-app WebView');
            }
          }
        } else {
          // Fallback to JSON payload method
          const payload = {
            session: {
              orderID: orderId || '',
              payment_session_id: sessionId,
              environment: (env === 'PROD' || env === 'production') ? 'PRODUCTION' : 'SANDBOX'
            },
            components: ['CARD', 'UPI', 'NB', 'WALLET', 'PAY_LATER', 'EMI'],
            theme: {
              navigationBarBackgroundColor: '#4f46e5',
              navigationBarTextColor: '#ffffff',
              buttonBackgroundColor: '#4f46e5',
              buttonTextColor: '#ffffff',
              primaryTextColor: '#111827',
              secondaryTextColor: '#6b7280'
            }
          } as any;

          PGSDK.setCallback({
            onVerify: (verifiedOrderId: string) => {
              onSuccess && onSuccess({ orderId: verifiedOrderId || payload.session.orderID || '', paymentId: '', signature: '' });
              onClose && onClose();
            },
            onError: (error: any, errOrderId?: string) => {
              const message = (error && (error.message || error.getMessage?.())) || 'Payment failed';
              onFailure && onFailure(message);
              onClose && onClose();
            }
          });

          const timeoutId = setTimeout(() => {
            console.log('⏰ Native SDK timeout - attempting PGSDK.doWebPayment fallback...');
            try {
              PGSDK.doWebPayment(JSON.stringify({ session: payload.session }));
              console.log('🚀 Invoked PGSDK.doWebPayment with session as fallback');
            } catch (err) {
              console.log('🔄 JSON doWebPayment fallback failed, will use in-app WebView');
            }
          }, 7000);
          console.log('🚀 Calling PGSDK.doPayment with payload...');
          PGSDK.doPayment(JSON.stringify(payload));
        }
      } catch (e) {
        console.error('❌ Native SDK initialization failed:', e);
        console.log('🔄 Falling back to WebView...');
      }
    } else {
      console.log('📱 PaymentModal: Using WebView fallback');
      console.log('   - Visible:', visible);
      console.log('   - Mode:', mode);
      console.log('   - PGSDK available:', !!PGSDK);
      console.log('   - SessionId:', !!sessionId);
      console.log('   - Platform:', Platform.OS);
      
      if (!PGSDK && Platform.OS !== 'web') {
        console.log('⚠️ Native Cashfree SDK not available in Expo Go');
        console.log('💡 To use native SDK, build a development build with:');
        console.log('   npx expo run:android (for Android)');
        console.log('   npx expo run:ios (for iOS)');
      }
    }
  }, [visible, mode, sessionId, env, orderId, appId]);

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
          
          {mode === 'cashfree' && PGSDK && Platform.OS !== 'web' ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" />
              <Text style={{ marginTop: 16, textAlign: 'center' }}>
                Processing payment with Cashfree SDK...
              </Text>
              <Text style={{ marginTop: 8, textAlign: 'center', color: '#666' }}>
                Native payment gateway is loading
              </Text>
              <Text style={{ marginTop: 16, textAlign: 'center', color: '#999', fontSize: 12 }}>
                If nothing happens in 10 seconds, try "Open in browser" below
              </Text>
            </View>
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