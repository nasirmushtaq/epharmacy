import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import {
  Searchbar,
  Card,
  Text,
  Button,
  Chip,
  ActivityIndicator,
  IconButton,
  Surface,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Medicine } from '../../types/global';
import { useCart } from '../../contexts/CartContext';
import { useNavigation } from '@react-navigation/native';

// Simple inline debounce hook
function useDebouncedValue(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const MedicinesScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const navigation = useNavigation<any>();

  // Debounce search query to reduce API calls
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  // Fetch medicines from API with server-side filtering
  const { data: medicinesResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['medicines', debouncedSearchQuery, selectedCategory],
    queryFn: async () => {
      console.log('🔍 Fetching medicines with search:', debouncedSearchQuery, 'category:', selectedCategory);
      
      // Build query parameters
      const params = new URLSearchParams();
      
      if (debouncedSearchQuery.trim()) {
        params.append('search', debouncedSearchQuery.trim());
      }
      
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      
      // Add pagination and sorting
      params.append('limit', '50');
      params.append('sortBy', 'name');
      params.append('sortOrder', 'asc');
      
      const queryString = params.toString();
      const url = `/api/medicines${queryString ? `?${queryString}` : ''}`;
      
      console.log('🔍 API URL:', url);
      const response = await api.get(url);
      console.log('🔍 API Response:', response.data);
      
      return response.data; // Return full response with pagination info
    },
    staleTime: 30000, // Cache results for 30 seconds
  });

  // Extract medicines and pagination from response
  const medicines = (medicinesResponse as any)?.data || [];
  const pagination = (medicinesResponse as any)?.pagination || {};

  const categories = ['tablets', 'capsules', 'syrups', 'injections', 'ointments', 'supplements', 'antibiotics', 'painkillers'];

  const { addItem, items } = useCart();

  // remove local cartItems state usage and compute quantity from cart context
  const getQuantityInCart = (medicineId: string) => {
    const line = items.find(i => i.medicineId === medicineId);
    return line ? line.quantity : 0;
  };

  const addToCart = async (medicine: Medicine) => {
    console.log('AddToCart pressed for', medicine._id, medicine.name, 'stock', medicine.stockQuantity);
    const isRx = !!medicine.isPrescriptionRequired;
    if (typeof medicine.stockQuantity === 'number' && medicine.stockQuantity <= 0) {
      console.log('Blocked by out-of-stock');
      Alert.alert('Out of Stock', 'This medicine is currently out of stock');
      return;
    }
    await addItem({ medicineId: medicine._id, name: medicine.name, price: medicine.sellingPrice || 0, quantity: 1, isPrescriptionRequired: isRx });
    console.log('Added to cart');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading medicines...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to load medicines</Text>
        <Button mode="contained" onPress={() => refetch()}>
          Retry
        </Button>
      </View>
    );
  }

  const renderMedicineCard = ({ item }: { item: Medicine }) => (
    <Card style={styles.medicineCard} onPress={() => navigation.navigate('MedicineDetail', { id: item._id })}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.medicineInfo}>
            <Text style={styles.medicineName}>{item.name}</Text>
            <Text style={styles.medicineBrand}>{item.brand}</Text>
            {item.isPrescriptionRequired && (
              <Chip 
                icon="medical-bag" 
                mode="outlined" 
                compact 
                style={styles.prescriptionChip}
                textStyle={styles.chipText}
              >
                Rx Required
              </Chip>
            )}
          </View>
          <View style={[styles.medicineImage, styles.placeholderImage]}>
            <IconButton icon="medication" size={30} iconColor="#ccc" />
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.priceContainer}>
          <View>
            <Text style={styles.sellingPrice}>₹{item.sellingPrice}</Text>
            {item.mrp > item.sellingPrice && (
              <Text style={styles.mrpPrice}>MRP: ₹{item.mrp}</Text>
            )}
          </View>
          <View style={styles.stockInfo}>
            <Text style={[
              styles.stockText,
              { color: item.stockQuantity > 0 ? '#4CAF50' : '#F44336' }
            ]}>
              {item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : 'Out of stock'}
            </Text>
          </View>
        </View>

        <View style={styles.actionContainer}>
          <View style={styles.quantityContainer}>
            {getQuantityInCart(item._id) > 0 && (
              <Surface style={styles.quantityBadge}>
                <Text style={styles.quantityText}>
                  {getQuantityInCart(item._id)} in cart
                </Text>
              </Surface>
            )}
          </View>
          
          <Button
            mode="contained"
            onPress={() => addToCart(item)}
            disabled={(typeof item.stockQuantity === 'number' && item.stockQuantity <= 0) || getQuantityInCart(item._id) >= (item.stockQuantity ?? Number.MAX_SAFE_INTEGER)}
            style={styles.addButton}
            compact
          >
            Add to Cart
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const renderCategoryChip = (category: string) => (
    <Chip
      key={category}
      mode={selectedCategory === category ? 'flat' : 'outlined'}
      selected={selectedCategory === category}
      onPress={() => setSelectedCategory(category)}
      style={styles.categoryChip}
    >
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </Chip>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <Surface style={styles.searchContainer}>
        <Searchbar
          placeholder="Search medicines..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          iconColor="#2196F3"
        />
      </Surface>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={['all', ...categories]}
          renderItem={({ item }) => 
            item === 'all' ? (
              <Chip
                key="all"
                mode={selectedCategory === 'all' ? 'flat' : 'outlined'}
                selected={selectedCategory === 'all'}
                onPress={() => setSelectedCategory('all')}
                style={styles.categoryChip}
              >
                All
              </Chip>
            ) : renderCategoryChip(item)
          }
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        />
      </View>

      {/* Results Info */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {pagination.total ? `${pagination.total} medicine${pagination.total !== 1 ? 's' : ''} found` : `${medicines.length} medicine${medicines.length !== 1 ? 's' : ''} found`}
          {debouncedSearchQuery && ` for "${debouncedSearchQuery}"`}
          {selectedCategory !== 'all' && ` in ${selectedCategory}`}
        </Text>
        {pagination.pages > 1 && (
          <Text style={styles.paginationText}>
            Page {pagination.current} of {pagination.pages}
          </Text>
        )}
      </View>

      {/* Medicines List */}
      <FlatList
        data={medicines}
        renderItem={renderMedicineCard}
        keyExtractor={(item) => item._id}
        style={styles.medicinesList}
        contentContainerStyle={styles.medicinesContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <IconButton icon="search-off" size={64} iconColor="#ccc" />
              <Text style={styles.emptyText}>
                {debouncedSearchQuery || selectedCategory !== 'all'
                  ? 'No medicines found matching your criteria'
                  : 'No medicines available'
                }
              </Text>
              <Text style={styles.emptySubtext}>
                {debouncedSearchQuery 
                  ? 'Try adjusting your search terms or category filters'
                  : 'Check back later for new medicines'
                }
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      />

      {/* Loading state for initial load */}
      {isLoading && medicines.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>
            {debouncedSearchQuery ? 'Searching medicines...' : 'Loading medicines...'}
          </Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load medicines</Text>
          <Button mode="outlined" onPress={() => {
            // Force re-query by changing search state
            setSearchQuery(prev => prev + ' ');
            setTimeout(() => setSearchQuery(prev => prev.trim()), 100);
          }}>
            Retry
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchContainer: {
    margin: 16,
    borderRadius: 12,
    elevation: 2,
  },
  searchBar: {
    backgroundColor: 'transparent',
  },
  categoriesContainer: {
    marginBottom: 8,
  },
  categoriesContent: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  medicinesList: {
    flex: 1,
  },
  medicinesContent: {
    padding: 16,
  },
  medicineCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  medicineInfo: {
    flex: 1,
    marginRight: 12,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  medicineBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  prescriptionChip: {
    alignSelf: 'flex-start',
  },
  medicineImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sellingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  mrpPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  stockInfo: {
    alignItems: 'flex-end',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityContainer: {
    flex: 1,
  },
  quantityBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    elevation: 1,
  },
  quantityText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  addButton: {
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  paginationText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default MedicinesScreen; 