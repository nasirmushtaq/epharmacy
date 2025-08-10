import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
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
  FAB,
  Badge,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { Medicine } from '../../types/global';
import { useAuth } from '../../contexts/AuthContext';

const MedicinesScreen = ({ navigation }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [cartItems, setCartItems] = useState<{[key: string]: number}>({});
  const { state: authState } = useAuth();

  // Fetch medicines
  const { data: medicinesData, isLoading, refetch } = useQuery({
    queryKey: ['medicines', searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      params.append('limit', '50');

      const response = await api.get(`/api/medicines?${params}`);
      return response.data;
    },
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['medicine-categories'],
    queryFn: async () => {
      const response = await api.get('/api/medicines/meta/categories');
      return response.data;
    },
  });

  const medicines: Medicine[] = medicinesData?.data || [];
  const categories = categoriesData?.data || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const addToCart = (medicine: Medicine) => {
    if (medicine.isPrescriptionRequired && !authState.user) {
      Alert.alert('Login Required', 'Please login to purchase prescription medicines');
      return;
    }

    if (medicine.stockQuantity <= 0) {
      Alert.alert('Out of Stock', 'This medicine is currently out of stock');
      return;
    }

    const currentQuantity = cartItems[medicine._id] || 0;
    if (currentQuantity >= medicine.stockQuantity) {
      Alert.alert('Stock Limit', 'Cannot add more items than available in stock');
      return;
    }

    setCartItems(prev => ({
      ...prev,
      [medicine._id]: (prev[medicine._id] || 0) + 1
    }));

    Alert.alert('Added to Cart', `${medicine.name} added to cart successfully`);
  };

  const getTotalCartItems = () => {
    return Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);
  };

  const renderMedicineCard = ({ item }: { item: Medicine }) => (
    <Card style={styles.medicineCard}>
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
              >
                Rx Required
              </Chip>
            )}
          </View>
          {item.images && item.images.length > 0 ? (
            <Image 
              source={{ uri: item.images[0].url }}
              style={styles.medicineImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.medicineImage, styles.placeholderImage]}>
              <Icon name="medication" size={40} color="#ccc" />
            </View>
          )}
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
            {cartItems[item._id] > 0 && (
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityText}>
                  {cartItems[item._id]} in cart
                </Text>
              </View>
            )}
          </View>
          
          <Button
            mode="contained"
            onPress={() => addToCart(item)}
            disabled={item.stockQuantity <= 0 || (cartItems[item._id] || 0) >= item.stockQuantity}
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

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading medicines...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <Searchbar
        placeholder="Search medicines..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        iconColor="#2196F3"
      />

      {/* Categories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        <Chip
          mode={selectedCategory === 'all' ? 'flat' : 'outlined'}
          selected={selectedCategory === 'all'}
          onPress={() => setSelectedCategory('all')}
          style={styles.categoryChip}
        >
          All
        </Chip>
        {categories.map(renderCategoryChip)}
      </ScrollView>

      {/* Results Info */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {medicines.length} medicine{medicines.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Medicines List */}
      <FlatList
        data={medicines}
        renderItem={renderMedicineCard}
        keyExtractor={(item) => item._id}
        style={styles.medicinesList}
        contentContainerStyle={styles.medicinesContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No medicines found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />

      {/* Cart FAB */}
      {getTotalCartItems() > 0 && (
        <FAB
          icon="shopping-cart"
          label={`Cart (${getTotalCartItems()})`}
          style={styles.cartFab}
          onPress={() => navigation.navigate('Cart')}
          variant="primary"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  searchBar: {
    margin: 16,
    borderRadius: 8,
    elevation: 2,
  },
  categoriesContainer: {
    maxHeight: 50,
    marginBottom: 8,
  },
  categoriesContent: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    marginRight: 8,
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
    fontSize: 18,
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
  cartFab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default MedicinesScreen; 