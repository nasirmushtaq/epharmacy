import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Button,
  IconButton,
  Chip,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAddress, Address } from '../contexts/AddressContext';

interface AddressSelectionProps {
  onAddressSelect: (address: Address) => void;
  onAddNewAddress: () => void;
  selectedAddress: Address | null;
  style?: any;
  onEditAddress?: (address: Address) => void;
}

const AddressCard: React.FC<{
  address: Address;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  loading: boolean;
}> = ({ address, isSelected, onSelect, onEdit, onDelete, onSetDefault, loading }) => {
  const getAddressTypeIcon = (type: string) => {
    switch (type) {
      case 'home': return 'home';
      case 'office': return 'business';
      default: return 'location-on';
    }
  };

  const getAddressTypeColor = (type: string) => {
    switch (type) {
      case 'home': return '#4CAF50';
      case 'office': return '#2196F3';
      default: return '#FF9800';
    }
  };

  return (
    <Card
      onPress={onSelect}
      style={[
        styles.addressCard,
        isSelected && styles.selectedCard,
      ]}
      mode={isSelected ? 'elevated' : 'outlined'}
    >
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <MaterialIcons
                name={getAddressTypeIcon(address.addressType)}
                size={20}
                color={getAddressTypeColor(address.addressType)}
              />
              <Text style={styles.addressTitle}>{address.title}</Text>
              {address.isDefault && (
                <Chip style={styles.defaultChip} textStyle={styles.defaultChipText}>
                  Default
                </Chip>
              )}
            </View>
            
            <View style={styles.actionButtons}>
              <IconButton
                icon="pencil"
                size={20}
                onPress={onEdit}
                disabled={loading}
                iconColor="#666"
              />
              <IconButton
                icon="trash-can"
                size={20}
                onPress={onDelete}
                disabled={loading}
                iconColor="#f44336"
              />
            </View>
          </View>

          <Text style={styles.recipientName}>{address.name}</Text>
          <Text style={styles.phoneNumber}>{address.phone}</Text>
          <Text style={styles.fullAddress} numberOfLines={2}>
            {address.fullAddress}
          </Text>

          {!address.isDefault && (
            <Button
              mode="outlined"
              compact
              onPress={onSetDefault}
              style={styles.setDefaultButton}
              labelStyle={styles.setDefaultButtonText}
              disabled={loading}
            >
              Set as Default
            </Button>
          )}

          {isSelected && (
            <View style={styles.selectedIndicator}>
              <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
              <Text style={styles.selectedText}>Selected</Text>
            </View>
          )}
        </Card.Content>
    </Card>
  );
};

export const AddressSelection: React.FC<AddressSelectionProps> = ({
  onAddressSelect,
  onAddNewAddress,
  selectedAddress,
  style,
  onEditAddress,
}) => {
  const { state, deleteAddress, setDefaultAddress, fetchAddresses } = useAddress();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (address: Address) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete "${address.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(address._id);
              await deleteAddress(address._id);
            } catch (error) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', 'Failed to delete address. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (address: Address) => {
    try {
      await setDefaultAddress(address._id);
    } catch (error) {
      console.error('Error setting default address:', error);
      Alert.alert('Error', 'Failed to set default address. Please try again.');
    }
  };

  if (state.loading && state.addresses.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading addresses...</Text>
        <Button mode="text" onPress={() => {
          console.log('Manual refresh triggered');
          fetchAddresses();
        }} style={{ marginTop: 16 }}>
          Refresh
        </Button>
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{state.error}</Text>
        <Button mode="outlined" onPress={() => {
          console.log('Retry button pressed - refetching addresses');
          fetchAddresses();
        }}>
          Retry
        </Button>
      </View>
    );
  }

  if (state.addresses.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, style]}>
        <MaterialIcons name="location-off" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Addresses Found</Text>
        <Text style={styles.emptySubtitle}>
          Add your first delivery address to continue
        </Text>
        <Button
          mode="contained"
          onPress={onAddNewAddress}
          style={styles.addFirstButton}
          icon="plus"
        >
          Add Address
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle} numberOfLines={1}>Select Delivery Address</Text>
        <Button
          mode="contained"
          compact
          onPress={onAddNewAddress}
          icon="plus"
          style={styles.addButton}
          contentStyle={styles.addButtonContent}
          labelStyle={styles.addButtonText}
        >
          Add New
        </Button>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 12 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {state.addresses.map((address, index) => (
          <AddressCard
            key={address._id}
            address={address}
            isSelected={selectedAddress?._id === address._id}
            onSelect={() => onAddressSelect(address)}
            onEdit={() => {
              if (onEditAddress) onEditAddress(address);
            }}
            onDelete={() => handleDelete(address)}
            onSetDefault={() => handleSetDefault(address)}
            loading={deletingId === address._id || state.loading}
          />
        ))}
      </ScrollView>

      {/* Removed in-component footer; summary is shown in CartScreen */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  addFirstButton: {
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#2196F3',
    minWidth: 100,
    alignSelf: 'flex-end',
  },
  addButtonText: {
    fontSize: 12,
    includeFontPadding: false,
  },
  addButtonContent: {
    paddingHorizontal: 10,
    height: 34,
  },
  scrollView: {
    maxHeight: 340,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  addressCard: {
    marginBottom: 12,
    elevation: 2,
  },
  selectedCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  defaultChip: {
    backgroundColor: '#4CAF50',
    height: 24,
  },
  defaultChipText: {
    fontSize: 10,
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  fullAddress: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  setDefaultButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  setDefaultButtonText: {
    fontSize: 12,
    color: '#2196F3',
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  selectedText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  selectedAddressInfo: {
    padding: 16,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  footerAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});
