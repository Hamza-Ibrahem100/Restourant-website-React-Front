import React, { useState, useEffect, useRef, useCallback } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { db, storage } from '../firebase';
import { 
  ref, 
  set, 
  get, 
  update, 
  remove, 
  onValue, 
  push, 
  child,
  serverTimestamp 
} from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [reservations, setReservations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brokenImages, setBrokenImages] = useState({});
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [newAuthorizedEmail, setNewAuthorizedEmail] = useState('');
  
  const [newMenuItem, setNewMenuItem] = useState({ 
    name: '', 
    price: '', 
    category: 'mains', 
    description: '', 
    image: '', 
    is_available: true,
    is_hidden: false,
    stock: 20
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    address: '', 
    loyalty_points: 0 
  });
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const [analytics, setAnalytics] = useState({ 
    totalRevenue: 0, 
    popularItems: [], 
    orderStatusCounts: {} 
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [lowStockItems, setLowStockItems] = useState([]);
  const [selectedMenuItems, setSelectedMenuItems] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [selectedReservations, setSelectedReservations] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  const prevOrderCount = useRef(0);
  const prevResCount = useRef(0);
  const soundEnabled = useRef(true);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      
      o.type = 'sine';
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      
      // Two-tone chime: C5 then E5
      o.frequency.setValueAtTime(523.25, ctx.currentTime);
      o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
      
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // Audio not supported
    }
  }, []);

  const calculateAnalytics = (ordersData) => {
    const totalRevenue = ordersData
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.total_price || o.total || 0), 0);

    const popularItems = {};
    ordersData.forEach(order => {
      (order.items || []).forEach(item => {
        const itemName = item.name || item.item_id;
        popularItems[itemName] = (popularItems[itemName] || 0) + item.quantity;
      });
    });

    const sortedPopular = Object.entries(popularItems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const orderStatusCounts = ordersData.reduce((acc, order) => {
      const status = order.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    setAnalytics({ totalRevenue, popularItems: sortedPopular, orderStatusCounts });
  };

  useEffect(() => {
    fetchAllData();
    
    const ordersRef = ref(db, 'orders');
    const ordersUnsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const orders = snapshot.val();
        const orderList = Object.entries(orders).map(([id, data]) => ({ id, ...data }));
        setOrders(orderList);
        calculateAnalytics(orderList);
        
        // Detect new order and play sound + notification
        if (prevOrderCount.current > 0 && orderList.length > prevOrderCount.current) {
          if (soundEnabled.current) playNotificationSound();
          const latestOrder = orderList[orderList.length - 1];
          setNotifications(prev => [{
            id: Date.now(),
            type: 'new_order',
            message: `New Order from ${latestOrder.customerName || 'Guest'} - $${(latestOrder.total_price || latestOrder.total || 0).toFixed(2)}`,
            timestamp: new Date(),
            read: false
          }, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
        prevOrderCount.current = orderList.length;
      } else {
        setOrders([]);
        prevOrderCount.current = 0;
      }
    }, (error) => console.error('Orders listener error:', error));

    const reservationsRef = ref(db, 'reservations');
    const reservationsUnsubscribe = onValue(reservationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const reservations = snapshot.val();
        const resList = Object.entries(reservations).map(([id, data]) => ({ id, ...data }));
        setReservations(resList);
        
        // Detect new reservation and play sound + notification
        if (prevResCount.current > 0 && resList.length > prevResCount.current) {
          if (soundEnabled.current) playNotificationSound();
          const latestRes = resList[resList.length - 1];
          setNotifications(prev => [{
            id: Date.now(),
            type: 'new_reservation',
            message: `New Reservation from ${latestRes.name} for ${latestRes.party || 1} guests on ${latestRes.date}`,
            timestamp: new Date(),
            read: false
          }, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
        prevResCount.current = resList.length;
      } else {
        setReservations([]);
        prevResCount.current = 0;
      }
    }, (error) => console.error('Reservations listener error:', error));

    // Real-time listener for menu items
    const menuRef = ref(db, 'menu');
    const menuUnsubscribe = onValue(menuRef, (snapshot) => {
      if (snapshot.exists()) {
        const menu = snapshot.val();
        const menuList = Object.entries(menu).map(([id, data]) => ({ id, ...data }));
        setMenuItems(menuList);
        localStorage.setItem('foodlover_menu_cache', JSON.stringify({
          items: menuList,
          timestamp: Date.now()
        }));
      }
    }, (error) => console.error('Menu listener error:', error));

    // Real-time listener for users/customers
    const usersRef = ref(db, 'users');
    const usersUnsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const users = snapshot.val();
        const usersList = Object.entries(users).map(([id, data]) => ({ id, ...data }));
        setCustomers(usersList);
      }
    }, (error) => console.error('Users listener error:', error));

    // Real-time listener for authorized users
    const authRef = ref(db, 'authorized_users');
    const authUnsubscribe = onValue(authRef, (snapshot) => {
      if (snapshot.exists()) {
        const authUsers = snapshot.val();
        const authList = Object.entries(authUsers).map(([id, data]) => ({ id, ...data }));
        setAuthorizedEmails(authList);
      }
    }, (error) => console.error('Auth users listener error:', error));

    return () => {
      ordersUnsubscribe();
      reservationsUnsubscribe();
      menuUnsubscribe();
      usersUnsubscribe();
      authUnsubscribe();
    };
  }, []);

  const fetchAllData = async () => {
    console.log('fetchAllData called');
    const MENU_CACHE_KEY = 'foodlover_menu_cache';
    const CACHE_EXPIRY = 1000 * 60 * 30;

    try {
      // Load from cache first for instant display
      const cachedMenu = localStorage.getItem(MENU_CACHE_KEY);
      if (cachedMenu) {
        const { items, timestamp } = JSON.parse(cachedMenu);
        if (Date.now() - timestamp < CACHE_EXPIRY && items.length > 0) {
          setMenuItems(items);
        }
      }

      // Fetch from Realtime Database
      console.log('Fetching from RTDB...');
      const [reservationsSnap, customersSnap, ordersSnap, menuSnap, authEmailsSnap] = await Promise.all([
        get(ref(db, 'reservations')),
        get(ref(db, 'users')),
        get(ref(db, 'orders')),
        get(ref(db, 'menu')),
        get(ref(db, 'authorized_users'))
      ]);

      console.log('RTDB data received:',
        'reservations:', reservationsSnap.exists() ? Object.keys(reservationsSnap.val()).length : 0,
        'users:', customersSnap.exists() ? Object.keys(customersSnap.val()).length : 0,
        'orders:', ordersSnap.exists() ? Object.keys(ordersSnap.val()).length : 0,
        'menu:', menuSnap.exists() ? Object.keys(menuSnap.val()).length : 0
      );

      const resData = reservationsSnap.exists() ? Object.entries(reservationsSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
      const custData = customersSnap.exists() ? Object.entries(customersSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
      const ordData = ordersSnap.exists() ? Object.entries(ordersSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
      const menuData = menuSnap.exists() ? Object.entries(menuSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
      const authData = authEmailsSnap.exists() ? Object.entries(authEmailsSnap.val()).map(([id, data]) => ({ id, ...data })) : [];

      // Update cache
      localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({
        items: menuData,
        timestamp: Date.now()
      }));

      setReservations(resData);
      setCustomers(custData);
      setOrders(ordData);
      setMenuItems(menuData);
      setAuthorizedEmails(authData);

      calculateAnalytics(ordData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAuthorizedEmail = async () => {
    if (!newAuthorizedEmail.trim()) return;
    try {
      const newRef = push(ref(db, 'authorized_users'));
      await set(newRef, {
        email: newAuthorizedEmail.trim().toLowerCase(),
        addedAt: Date.now()
      });
      setNewAuthorizedEmail('');
      fetchAllData();
    } catch (error) {
      console.error('Error adding authorized email:', error);
    }
  };

const removeAuthorizedEmail = async (id) => {
    if (window.confirm('Remove this authorized user?')) {
      try {
        await remove(ref(db, `authorized_users/${id}`));
        fetchAllData();
      } catch (error) {
        console.error('Error removing authorized email:', error);
      }
    }
};

  const handleStatus = async (collectionName, id, newStatus) => {
    try {
      await update(ref(db, `${collectionName}/${id}`), { 
        status: newStatus,
        updatedAt: Date.now()
      });
      fetchAllData();
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const handleDelete = async (collectionName, id) => {
    if (window.confirm('Delete this item?')) {
      try {
        await remove(ref(db, `${collectionName}/${id}`));
        fetchAllData();
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const handleBulkDeleteMenu = async () => {
    try {
      const deletePromises = selectedMenuItems.map(id => remove(ref(db, `menu/${id}`)));
      await Promise.all(deletePromises);
      setSelectedMenuItems([]);
      setShowDeleteModal(false);
      setDeleteItemId(null);
      fetchAllData();
      localStorage.removeItem('foodlover_menu_cache');
    } catch (error) {
      console.error('Error bulk deleting menu items:', error);
    }
  };

  const handleSingleDeleteMenu = async () => {
    if (!deleteItemId) return;
    try {
      await remove(ref(db, `menu/${deleteItemId}`));
      setDeleteItemId(null);
      setDeleteType(null);
      setShowDeleteModal(false);
      fetchAllData();
      localStorage.removeItem('foodlover_menu_cache');
    } catch (error) {
      console.error('Error deleting menu item:', error);
    }
  };

  const handleBulkDelete = async (type, ids) => {
    try {
      const deletePromises = ids.map(id => remove(ref(db, `${type}/${id}`)));
      await Promise.all(deletePromises);
      if (type === 'menu') { setSelectedMenuItems([]); localStorage.removeItem('foodlover_menu_cache'); }
      if (type === 'users') setSelectedUsers([]);
      if (type === 'orders') setSelectedOrders([]);
      if (type === 'reservations') setSelectedReservations([]);
      setShowDeleteModal(false);
      setDeleteType(null);
      fetchAllData();
    } catch (error) {
      console.error('Error bulk deleting:', error);
    }
  };

  const handleSingleDelete = async (type, id) => {
    if (!id) return;
    try {
      await remove(ref(db, `${type}/${id}`));
      setDeleteItemId(null);
      setDeleteType(null);
      setShowDeleteModal(false);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const confirmDelete = (type, id = null) => {
    setDeleteItemId(id);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const handleToggleAvailability = async (itemId, currentStatus) => {
    try {
      await update(ref(db, `menu/${itemId}`), { 
        is_available: !currentStatus 
      });
      fetchAllData();
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
  };

  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const uploadImage = async (file) => {
    if (!file) return { fullUrl: null, thumbnailUrl: null };
    setUploadingImage(true);
    try {
      // Compress full image (reduce to ~200KB, WebP format)
      const fullOptions = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: 'image/webp'
      };
      const fullCompressed = await imageCompression(file, fullOptions);
      
      // Upload full image
      const fullRef = ref(storage, `menu-images/${Date.now()}_full.webp`);
      await uploadBytes(fullRef, fullCompressed);
      const fullUrl = await getDownloadURL(fullRef);

      // Create and upload thumbnail (smaller, ~50KB)
      const thumbOptions = {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 300,
        useWebWorker: true,
        fileType: 'image/webp'
      };
      const thumbCompressed = await imageCompression(file, thumbOptions);
      
      const thumbRef = ref(storage, `menu-images/${Date.now()}_thumb.webp`);
      await uploadBytes(thumbRef, thumbCompressed);
      const thumbnailUrl = await getDownloadURL(thumbRef);

      setUploadingImage(false);
      return { fullUrl, thumbnailUrl };
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadingImage(false);
      return { fullUrl: null, thumbnailUrl: null };
    }
  };

  const handleAddMenuItem = async () => {
    if (!newMenuItem.name) {
      alert('Please enter item name');
      return;
    }
    if (!newMenuItem.price) {
      alert('Please enter item price');
      return;
    }
    try {
      // Create new item in RTDB
      const newItemRef = push(ref(db, 'menu'));
      const newItemId = newItemRef.key;

      let imageUrl = '';
      let thumbnailUrl = '';
      
      // Upload image if selected file
      if (selectedImage) {
        const { fullUrl, thumbnailUrl: thumbUrl } = await uploadImage(selectedImage);
        imageUrl = fullUrl;
        thumbnailUrl = thumbUrl;
      } else if (newMenuItem.image) {
        // Use URL if provided
        imageUrl = newMenuItem.image;
        thumbnailUrl = newMenuItem.image;
      }

      // Update with image URLs
      if (imageUrl) {
        await update(ref(db, `menu/${newItemId}`), { 
          image: imageUrl,
          thumbnail: thumbnailUrl || imageUrl
        });
      } else {
        // Set initial data if no image
        await set(ref(db, `menu/${newItemId}`), {
          name: newMenuItem.name,
          price: parseFloat(newMenuItem.price),
          category: newMenuItem.category || 'mains',
          description: newMenuItem.description || '',
          is_available: true,
          is_hidden: newMenuItem.is_hidden || false,
          stock: parseInt(newMenuItem.stock) || 20,
          createdAt: Date.now(),
          image: '',
          thumbnail: ''
        });
      }

      setNewMenuItem({ 
        name: '', 
        price: '', 
        category: 'mains', 
        description: '', 
        image: '', 
        is_available: true,
        is_hidden: false,
        stock: 20
      });
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Clear homepage cache so new items appear immediately
      localStorage.removeItem('foodlover_menu_cache');
      
      fetchAllData();
      alert('Menu item added successfully!');
    } catch (error) {
      console.error('Error adding menu item:', error);
      alert('Error adding menu item: ' + error.message);
    }
  };

  const seedFromUI = async () => {
    const samples = [
      { name: 'Burrata & Heirloom Tomatoes', category: 'starters', price: 18, description: 'Fresh burrata cheese with seasonal heirloom tomatoes, aged balsamic reduction, fresh basil', image: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&q=80', is_available: true, is_hidden: false, stock: 25 },
      { name: 'Wagyu Beef Tartare', category: 'starters', price: 28, description: 'Premium A5 wagyu beef, quail egg, capers, cornichons, truffle aioli', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Tuna Tartare', category: 'starters', price: 22, description: 'Yellowfin tuna, avocado, sesame, crispy wonton chips', image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Crispy Calamari', category: 'starters', price: 16, description: 'Lightly fried calamari, spicy aioli, fresh lemon, herbs', image: 'https://images.unsplash.com/photo-1599487486515-8d0f6f542d4f?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'French Onion Soup', category: 'starters', price: 14, description: 'Caramelized onions, beef broth, gruyère crouton', image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Dry-Aged Ribeye', category: 'mains', price: 58, description: '45-day dry-aged prime ribeye, bone marrow butter, roasted vegetables', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Filet Mignon', category: 'mains', price: 52, description: '8oz center-cut filet, red wine reduction, truffle mashed potatoes', image: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Pan-Seared Salmon', category: 'mains', price: 38, description: 'Wild-caught salmon, lemon beurre blanc, asparagus, dill', image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Roasted Duck Breast', category: 'mains', price: 42, description: 'Cherry gastrique, sweet potato purée, baby bok choy', image: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Truffle Risotto', category: 'mains', price: 34, description: 'Arborio rice, black truffle, aged parmesan, fresh herbs', image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Lobster Thermidor', category: 'mains', price: 65, description: 'Maine lobster, cognac cream, gruyère, roasted fingerling potatoes', image: 'https://images.unsplash.com/photo-1553247407-23251b9c19e8?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Grilled Lamb Chops', category: 'mains', price: 48, description: 'Herb-crusted Colorado lamb, mint sauce, rosemary roasted potatoes', image: 'https://images.unsplash.com/photo-1514516345957-556ca7d90a29?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Chocolate Lava Cake', category: 'desserts', price: 16, description: 'Warm Valrhona chocolate cake, vanilla bean ice cream, raspberry coulis', image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Crème Brûlée', category: 'desserts', price: 12, description: 'Classic vanilla bean custard, caramelized sugar, fresh berries', image: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Tiramisu', category: 'desserts', price: 14, description: 'Espresso-soaked ladyfingers, mascarpone, cocoa, amaretto', image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Panna Cotta', category: 'desserts', price: 11, description: 'Vanilla bean panna cotta, seasonal berry compote', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Cheese Board', category: 'desserts', price: 24, description: 'Selection of artisan cheeses, honeycomb, nuts, fig jam', image: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Old Fashioned', category: 'drinks', price: 18, description: 'Bourbon, smoked maple, angostura bitters, orange peel', image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Signature Martini', category: 'drinks', price: 16, description: 'Premium vodka, elderflower, cucumber, lime', image: 'https://images.unsplash.com/photo-1575023782549-62ca0d244b39?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'House Red Wine', category: 'drinks', price: 14, description: 'Rotating selection of premium red wines by the glass', image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'House White Wine', category: 'drinks', price: 12, description: 'Rotating selection of premium white wines by the glass', image: 'https://images.unsplash.com/photo-1566754436893-a5fc3af4eb33?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Sparkling Water', category: 'drinks', price: 6, description: 'San Pellegrino sparkling mineral water', image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Fresh Pressed Juice', category: 'drinks', price: 10, description: 'Daily selection of fresh pressed fruit or vegetable juices', image: 'https://images.unsplash.com/photo-1600271884442-392fc1c4d909?w=800&q=80', is_available: true, is_hidden: false },
      { name: 'Chef\'s Secret Menu Item #1', category: 'specials', price: 85, description: 'A unique creation available only to VIP guests. Ask your server.', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80', is_available: true, is_hidden: true },
      { name: 'Chef\'s Secret Menu Item #2', category: 'specials', price: 95, description: 'An exclusive dish crafted with rare ingredients.', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', is_available: true, is_hidden: true },
      { name: 'Exclusive Wine Pairing', category: 'drinks', price: 120, description: 'A curated 5-course wine pairing experience', image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b7ebb01?w=600&q=80', is_available: true, is_hidden: true },
      { name: 'Private Dining Special', category: 'specials', price: 150, description: 'Personalized menu for private events', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', is_available: true, is_hidden: true }
    ];
    try {
      console.log('Seeding menu items...');
      for (const item of samples) {
        await push(ref(db, 'menu'), { ...item, createdAt: Date.now() });
      }
      console.log('Menu items seeded successfully!');
      fetchAllData();
    } catch (err) {
      console.error('Error seeding menu items:', err);
    }
  };

  const seedCustomersFromUI = async () => {
    const customerSamples = [
      { name: 'Ahmed Hassan', email: 'ahmed@example.com', phone: '01012345678', address: 'Cairo, Egypt', loyalty_points: 150 },
      { name: 'Sarah Mohamed', email: 'sarah@example.com', phone: '01023456789', address: 'Alexandria, Egypt', loyalty_points: 280 },
      { name: 'Omar Ibrahim', email: 'omar@example.com', phone: '01034567890', address: 'Giza, Egypt', loyalty_points: 95 },
      { name: 'Fatima Ahmed', email: 'fatima@example.com', phone: '01045678901', address: 'Mansoura, Egypt', loyalty_points: 420 },
      { name: 'Ali Hassan', email: 'ali@example.com', phone: '01056789012', address: 'Tanta, Egypt', loyalty_points: 175 },
      { name: 'Layla Mohamed', email: 'layla@example.com', phone: '01067890123', address: 'Suez, Egypt', loyalty_points: 310 },
      { name: 'Youssef Ibrahim', email: 'youssef@example.com', phone: '01078901234', address: 'Zagazig, Egypt', loyalty_points: 60 },
      { name: 'Noor Ahmed', email: 'noor@example.com', phone: '01089012345', address: 'Aswan, Egypt', loyalty_points: 540 }
    ];
    try {
      console.log('Seeding customers...');
      for (const cust of customerSamples) {
        await push(ref(db, 'users'), { ...cust, createdAt: Date.now() });
      }
      console.log('Customers seeded successfully!');
      fetchAllData();
    } catch (err) {
      console.error('Error seeding customers:', err);
    }
  };

  const seedOrdersFromUI = async () => {
    const orderSamples = [
      { customerName: 'Ahmed Hassan', phone: '01012345678', tableNumber: 5, items: [{ name: 'Burrata & Heirloom Tomatoes', quantity: 1, price: 18 }, { name: 'Dry-Aged Ribeye', quantity: 1, price: 56 }], total: 74, status: 'completed', orderType: 'dine-in', createdAt: new Date(Date.now() - 86400000 * 2) },
      { customerName: 'Sarah Mohamed', phone: '01023456789', tableNumber: 8, items: [{ name: 'Wagyu Beef Tartar', quantity: 1, price: 24 }, { name: 'Pan-Seared Salmon', quantity: 1, price: 38 }], total: 62, status: 'completed', orderType: 'dine-in', createdAt: new Date(Date.now() - 86400000 * 3) },
      { customerName: 'Omar Ibrahim', phone: '01034567890', tableNumber: 12, items: [{ name: 'Truffle Risotto', quantity: 2, price: 32 }], total: 64, status: 'preparing', orderType: 'dine-in', createdAt: new Date(Date.now() - 3600000) },
      { customerName: 'Fatima Ahmed', phone: '01045678901', tableNumber: 3, items: [{ name: 'Chocolate Fondant', quantity: 2, price: 14 }, { name: 'Crème Brûlée', quantity: 1, price: 12 }], total: 40, status: 'pending', orderType: 'dine-in', createdAt: new Date() },
      { customerName: 'Ali Hassan', phone: '01056789012', tableNumber: null, items: [{ name: 'Dry-Aged Ribeye', quantity: 1, price: 56 }, { name: 'House Wine Selection', quantity: 2, price: 14 }], total: 84, status: 'ready', orderType: 'pickup', createdAt: new Date(Date.now() - 7200000) },
      { customerName: 'Layla Mohamed', phone: '01067890123', tableNumber: 15, items: [{ name: 'Roasted Duck Breast', quantity: 1, price: 42 }, { name: 'Tiramisu', quantity: 1, price: 13 }], total: 55, status: 'completed', orderType: 'dine-in', createdAt: new Date(Date.now() - 86400000) },
      { customerName: 'Youssef Ibrahim', phone: '01078901234', tableNumber: null, items: [{ name: 'Ember Old Fashioned', quantity: 3, price: 16 }], total: 48, status: 'completed', orderType: 'delivery', createdAt: new Date(Date.now() - 86400000 * 4) },
      { customerName: 'Noor Ahmed', phone: '01089012345', tableNumber: 7, items: [{ name: 'Grilled Chicken', quantity: 1, price: 16 }, { name: 'Pan-Seared Salmon', quantity: 1, price: 38 }, { name: 'Crème Brûlée', quantity: 1, price: 12 }], total: 66, status: 'preparing', orderType: 'dine-in', createdAt: new Date(Date.now() - 1800000) }
    ];
    try {
      console.log('Seeding orders...');
      for (const ord of orderSamples) {
        await push(ref(db, 'orders'), { ...ord, createdAt: Date.now() });
      }
      console.log('Orders seeded successfully!');
      fetchAllData();
    } catch (err) {
      console.error('Error seeding orders:', err);
    }
  };


  const handleUpdateMenuItem = async () => {
    if (!editingMenuItem) return;
    try {
      await update(ref(db, `menu/${editingMenuItem.id}`), {
        ...editingMenuItem,
        price: parseFloat(editingMenuItem.price),
        updatedAt: Date.now()
      });
      setEditingMenuItem(null);
      fetchAllData();
    } catch (error) {
      console.error('Error updating menu item:', error);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email) return;
    try {
      await push(ref(db, "users"), {
        ...newCustomer,
        loyalty_points: parseInt(newCustomer.loyalty_points) || 0,
        createdAt: Date.now()
      });
      setNewCustomer({ name: '', email: '', phone: '', address: '', loyalty_points: 0 });
      fetchAllData();
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;
    try {
      await update(ref(db, `users/${editingCustomer.id}`), {
        ...editingCustomer,
        loyalty_points: parseInt(editingCustomer.loyalty_points) || 0,
        updatedAt: Date.now()
      });
      setEditingCustomer(null);
      fetchAllData();
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const printReport = (type) => {
    let content = `
      <html>
      <head>
        <title>Restaurant Report - ${type}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #D4A574; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #D4A574; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .total { font-weight: bold; color: #D4A574; }
          .date { color: #666; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Restaurant ${type} Report</h1>
    `;
    
    if (type === 'Orders') {
      content += `<table><tr><th>ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Type</th></tr>`;
      orders.forEach(o => {
        const itemsList = (o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
        content += `<tr>
          <td>#${o.id?.slice(0, 8) || '-'}</td>
          <td>${o.customerName || 'Guest'}</td>
          <td>${itemsList}</td>
          <td class="total">$${(o.total_price || o.total || 0).toFixed(2)}</td>
          <td>${o.status || '-'}</td>
          <td>${o.orderType || '-'}</td>
        </tr>`;
      });
      content += `</table>`;
    } else if (type === 'Customers') {
      content += `<table><tr><th>Name</th><th>Email</th><th>Phone</th><th>Loyalty Points</th><th>Orders</th></tr>`;
      customers.forEach(c => {
        content += `<tr>
          <td>${c.name || '-'}</td>
          <td>${c.email || '-'}</td>
          <td>${c.phone || '-'}</td>
          <td>${c.loyalty_points || 0}</td>
          <td>${orders.filter(o => o.customerId === c.id).length}</td>
        </tr>`;
      });
      content += `</table>`;
    } else if (type === 'Menu') {
      content += `<table><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Available</th></tr>`;
      menuItems.forEach(m => {
        content += `<tr>
          <td>${m.name || '-'}</td>
          <td>${m.category || '-'}</td>
          <td class="total">$${(m.price || 0).toFixed(2)}</td>
          <td>${m.stock || 0}</td>
          <td>${m.is_available !== false ? 'Yes' : 'No'}</td>
        </tr>`;
      });
      content += `</table>`;
    }
    
    content += `<div class="date">Generated on ${new Date().toLocaleString()}</div></body></html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const checkLowStock = () => {
    const lowStock = menuItems.filter(item => item.stock !== undefined && item.stock < 5);
    setLowStockItems(lowStock);
  };

  const updateStock = async (itemId, newStock) => {
    try {
      await update(ref(db, `menu/${itemId}`), { stock: parseInt(newStock) });
      fetchAllData();
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: 'Pending', class: 'status-pending' },
      'confirmed': { label: 'Confirmed', class: 'status-confirmed' },
      'preparing': { label: 'Preparing', class: 'status-preparing' },
      'ready': { label: 'Ready', class: 'status-ready' },
      'out_for_delivery': { label: 'Out for Delivery', class: 'status-ready' },
      'completed': { label: 'Completed', class: 'status-completed' },
      'cancelled': { label: 'Cancelled', class: 'status-cancelled' }
    };
    const statusInfo = statusMap[status] || statusMap['pending'];
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  if (loading) {
    return (
      <>
        <Nav />
        <div style={{ padding: '120px 24px', textAlign: 'center', minHeight: '100vh' }}>
          <p>Loading dashboard...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div style={{ padding: '100px 24px 60px', minHeight: '100vh' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px' }}>Restaurant Dashboard</h1>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setActiveTab('notifications')}
                style={{ 
                  background: 'transparent', 
                  border: '1px solid var(--primary-accent)', 
                  color: 'var(--text-primary)', 
                  padding: '8px 16px', 
                  cursor: 'pointer', 
                  borderRadius: '4px' 
                }}
              >
                🔔 Notifications 
                {unreadCount > 0 && (
                  <span style={{ 
                    background: 'red', 
                    color: 'white', 
                    borderRadius: '50%', 
                    padding: '2px 8px', 
                    fontSize: '12px', 
                    marginLeft: '8px' 
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            marginBottom: '32px', 
            flexWrap: 'wrap', 
            borderBottom: '1px solid var(--secondary-accent)', 
            paddingBottom: '16px' 
          }}>
            {['overview', 'customers', 'orders', 'reservations', 'requests', 'menu', 'users', 'analytics', 'reports', 'notifications'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 20px',
                  background: activeTab === tab ? 'var(--primary-accent)' : 'transparent',
                  color: activeTab === tab ? 'var(--bg-dark)' : 'var(--text-primary)',
                  border: '1px solid var(--primary-accent)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontWeight: activeTab === tab ? '600' : '400'
                }}
              >
                {tab === 'users' ? 'User Access' : tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '24px', 
                marginBottom: '48px' 
              }}>
                <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Total Revenue</h3>
                  <p style={{ fontSize: '32px', color: 'var(--primary-accent)', fontFamily: 'Playfair Display, serif' }}>
                    ${analytics.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <div 
                  onClick={() => setActiveTab('orders')}
                  style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--secondary-accent)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Total Orders</h3>
                  <p style={{ fontSize: '32px', color: 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}>
                    {orders.length}
                  </p>
                  <span style={{ fontSize: '12px', color: 'var(--primary-accent)', marginTop: '8px', display: 'block' }}>Click to view →</span>
                </div>
                <div 
                  onClick={() => setActiveTab('customers')}
                  style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--secondary-accent)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Total Customers</h3>
                  <p style={{ fontSize: '32px', color: 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}>
                    {customers.length}
                  </p>
                  <span style={{ fontSize: '12px', color: 'var(--primary-accent)', marginTop: '8px', display: 'block' }}>Click to view →</span>
                </div>
                <div 
                  onClick={() => setActiveTab('reservations')}
                  style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--secondary-accent)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Reservations</h3>
                  <p style={{ fontSize: '32px', color: 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}>
                    {reservations.length}
                  </p>
                  <span style={{ fontSize: '12px', color: 'var(--primary-accent)', marginTop: '8px', display: 'block' }}>Click to view →</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div 
                  onClick={() => setActiveTab('orders')}
                  style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--secondary-accent)'; }}
                >
                  <h3 style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Order Status
                    <span style={{ fontSize: '12px', color: 'var(--primary-accent)' }}>→</span>
                  </h3>
                  {Object.entries(analytics.orderStatusCounts).map(([status, count]) => (
                    <div key={status} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '8px 0', 
                      borderBottom: '1px solid rgba(255,255,255,0.1)' 
                    }}>
                      <span style={{ textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
                <div 
                  onClick={() => setActiveTab('orders')}
                  style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--secondary-accent)'; }}
                >
                  <h3 style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Popular Items
                    <span style={{ fontSize: '12px', color: 'var(--primary-accent)' }}>→</span>
                  </h3>
                  {analytics.popularItems.map(([item, count], index) => (
                    <div key={item} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '8px 0', 
                      borderBottom: '1px solid rgba(255,255,255,0.1)' 
                    }}>
                      <span>{item}</span>
                      <span style={{ color: 'var(--primary-accent)' }}>{count} orders</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>Customer Management</h2>
              {customers.length === 0 && (
                <div style={{ padding: '24px', border: '2px solid var(--primary-accent)', borderRadius: '8px', marginBottom: 24, background: 'rgba(212, 165, 116, 0.1)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>No customers found!</p>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>Click below to add sample customer data.</p>
                  <button onClick={seedCustomersFromUI} style={{ padding: '14px 32px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Add Sample Customers</button>
                </div>
              )}
              
              <div style={{ background: 'var(--bg-card)', padding: '24px', marginBottom: '32px', border: '1px solid var(--secondary-accent)' }}>
                <h3 style={{ marginBottom: '16px' }}>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={editingCustomer ? editingCustomer.name : newCustomer.name}
                    onChange={(e) => editingCustomer
                      ? setEditingCustomer({...editingCustomer, name: e.target.value})
                      : setNewCustomer({...newCustomer, name: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={editingCustomer ? editingCustomer.email : newCustomer.email}
                    onChange={(e) => editingCustomer
                      ? setEditingCustomer({...editingCustomer, email: e.target.value})
                      : setNewCustomer({...newCustomer, email: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Phone"
                    value={editingCustomer ? editingCustomer.phone : newCustomer.phone}
                    onChange={(e) => editingCustomer
                      ? setEditingCustomer({...editingCustomer, phone: e.target.value})
                      : setNewCustomer({...newCustomer, phone: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                  <input
                    type="text"
                    placeholder="Address"
                    value={editingCustomer ? editingCustomer.address : newCustomer.address}
                    onChange={(e) => editingCustomer
                      ? setEditingCustomer({...editingCustomer, address: e.target.value})
                      : setNewCustomer({...newCustomer, address: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
                  <input
                    type="number"
                    placeholder="Loyalty Points"
                    value={editingCustomer ? editingCustomer.loyalty_points : newCustomer.loyalty_points}
                    onChange={(e) => editingCustomer
                      ? setEditingCustomer({...editingCustomer, loyalty_points: e.target.value})
                      : setNewCustomer({...newCustomer, loyalty_points: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                </div>
                <div>
                  {editingCustomer ? (
                    <>
                      <button onClick={handleUpdateCustomer} style={{ padding: '12px 24px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', cursor: 'pointer', marginRight: '12px' }}>Update Customer</button>
                      <button onClick={() => setEditingCustomer(null)} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={handleAddCustomer} style={{ padding: '12px 24px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', cursor: 'pointer' }}>Add Customer</button>
                  )}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--primary-accent)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.length === customers.length && customers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers(customers.map(c => c.id));
                          } else {
                            setSelectedUsers([]);
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Phone</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Address</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Loyalty Points</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Total Orders</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id} style={{ borderBottom: '1px solid var(--secondary-accent)', background: selectedUsers.includes(customer.id) ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}>
                      <td style={{ padding: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.includes(customer.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, customer.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== customer.id));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>{customer.name}</td>
                      <td style={{ padding: '12px' }}>{customer.email}</td>
                      <td style={{ padding: '12px' }}>{customer.phone || 'N/A'}</td>
                      <td style={{ padding: '12px' }}>{customer.address || 'N/A'}</td>
                      <td style={{ padding: '12px' }}>{customer.loyalty_points || 0}</td>
                      <td style={{ padding: '12px' }}>{orders.filter(o => o.userId === customer.id).length}</td>
                      <td style={{ padding: '12px' }}>
<button 
                          onClick={() => confirmDelete('users', customer.id)} 
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#e74c3c', 
                            cursor: 'pointer', 
                            fontSize: '16px' 
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedUsers.length > 0 && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e74c3c', fontWeight: '600' }}>
                    {selectedUsers.length} user(s) selected
                  </span>
                  <button 
                    onClick={() => confirmDelete('users')}
                    style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', borderRadius: '6px' }}
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>Order Management</h2>
              {orders.length === 0 && (
                <div style={{ padding: '24px', border: '2px solid var(--primary-accent)', borderRadius: '8px', marginBottom: 24, background: 'rgba(212, 165, 116, 0.1)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>No orders found!</p>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>Click below to add sample order data.</p>
                  <button onClick={seedOrdersFromUI} style={{ padding: '14px 32px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Add Sample Orders</button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '20px', border: '1px solid var(--secondary-accent)', borderRadius: '8px' }}>
                  <h3 style={{ color: 'var(--primary-accent)', marginBottom: '16px', fontSize: '18px' }}>Order Status Overview</h3>
                  {Object.entries(analytics.orderStatusCounts).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{status.replace('_', ' ')}</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary-accent)' }}>{count}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0 0', marginTop: '8px', borderTop: '2px solid var(--primary-accent)' }}>
                    <span style={{ fontWeight: 'bold' }}>Total Orders</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary-accent)', fontSize: '18px' }}>{orders.length}</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '20px', border: '1px solid var(--secondary-accent)', borderRadius: '8px' }}>
                  <h3 style={{ color: 'var(--primary-accent)', marginBottom: '16px', fontSize: '18px' }}>Popular Items</h3>
                  {analytics.popularItems.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No order data yet</p>
                  ) : (
                    analytics.popularItems.map(([item, count], index) => (
                      <div key={item} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>#{index + 1} {item}</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary-accent)' }}>{count} orders</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--primary-accent)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedOrders.length === orders.length && orders.length > 0}
                        onChange={(e) => { e.target.checked ? setSelectedOrders(orders.map(o => o.id)) : setSelectedOrders([]); }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Order ID</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Customer</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Phone</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Table #</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Items</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Total</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--secondary-accent)', background: selectedOrders.includes(order.id) ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}>
                      <td style={{ padding: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => { e.target.checked ? setSelectedOrders([...selectedOrders, order.id]) : setSelectedOrders(selectedOrders.filter(id => id !== order.id)); }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>#{order.id?.slice(0, 8)}</td>
                      <td style={{ padding: '12px' }}>{order.customerName || 'Guest'}</td>
                      <td style={{ padding: '12px' }}>{order.phone || 'N/A'}</td>
                      <td style={{ padding: '12px' }}>{order.tableNumber || 'N/A'}</td>
                      <td style={{ padding: '12px', maxWidth: '200px' }}>
                        {(order.items || []).map((item, idx) => (
                          <div key={idx} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {item.quantity}x {item.name} (${(item.price * item.quantity).toFixed(2)})
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--primary-accent)' }}>${(order.total_price || order.total || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px', textTransform: 'capitalize' }}>{order.orderType || 'N/A'}</td>
                      <td style={{ padding: '12px' }}>{getStatusBadge(order.status)}</td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => handleStatus('orders', order.id, 'pending')} style={{ margin: '2px', padding: '4px 8px', background: '#95a5a6', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px' }} title="Pending">⌛</button>
                        <button onClick={() => handleStatus('orders', order.id, 'preparing')} style={{ margin: '2px', padding: '4px 8px', background: '#f39c12', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px' }} title="Preparing">👨‍🍳</button>
                        <button onClick={() => handleStatus('orders', order.id, 'ready')} style={{ margin: '2px', padding: '4px 8px', background: '#27ae60', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px' }} title="Ready">✅</button>
                        <button onClick={() => handleStatus('orders', order.id, 'completed')} style={{ margin: '2px', padding: '4px 8px', background: '#2ecc71', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px' }} title="Completed">✔</button>
                        <button onClick={() => confirmDelete('orders', order.id)} style={{ margin: '2px', padding: '4px 8px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px' }} title="Delete">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedOrders.length > 0 && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e74c3c', fontWeight: '600' }}>{selectedOrders.length} order(s) selected</span>
                  <button onClick={() => confirmDelete('orders')} style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', borderRadius: '6px' }}>Delete Selected</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reservations' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>Reservation Management</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--primary-accent)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedReservations.length === reservations.length && reservations.length > 0}
                        onChange={(e) => { e.target.checked ? setSelectedReservations(reservations.map(r => r.id)) : setSelectedReservations([]); }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Customer</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Party Size</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Special Requests</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.length === 0 ? (
                    <tr><td colSpan="9" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>No reservations to display</td></tr>
                  ) : (
                    reservations.map(res => (
                      <tr key={res.id} style={{ borderBottom: '1px solid var(--secondary-accent)', background: selectedReservations.includes(res.id) ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedReservations.includes(res.id)}
                            onChange={(e) => { e.target.checked ? setSelectedReservations([...selectedReservations, res.id]) : setSelectedReservations(selectedReservations.filter(id => id !== res.id)); }}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>{res.name}</td>
                        <td style={{ padding: '12px' }}>{res.email}</td>
                        <td style={{ padding: '12px' }}>{res.date}</td>
                        <td style={{ padding: '12px' }}>{res.time}</td>
                        <td style={{ padding: '12px' }}>{res.party || 1}</td>
                        <td style={{ padding: '12px' }}>{getStatusBadge(res.status)}</td>
                        <td style={{ padding: '12px', maxWidth: '200px', fontSize: '14px' }}>{res.requests || 'None'}</td>
                        <td style={{ padding: '12px' }}>
                          <button onClick={() => handleStatus('reservations', res.id, 'confirmed')} style={{ margin: '2px', padding: '6px 12px', background: '#27ae60', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                          <button onClick={() => handleStatus('reservations', res.id, 'cancelled')} style={{ margin: '2px', padding: '6px 12px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✗</button>
                          <button onClick={() => confirmDelete('reservations', res.id)} style={{ margin: '2px', padding: '6px 12px', background: '#666', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {selectedReservations.length > 0 && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e74c3c', fontWeight: '600' }}>{selectedReservations.length} reservation(s) selected</span>
                  <button onClick={() => confirmDelete('reservations')} style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', borderRadius: '6px' }}>Delete Selected</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>Customer Requests</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                All special requests from reservations are displayed here for restaurant staff.
              </p>
              {reservations.filter(res => res.requests && res.requests.trim() !== '').length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '48px' }}>No customer requests at this time.</p>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {reservations.filter(res => res.requests && res.requests.trim() !== '').map(res => (
                    <div key={res.id} style={{ background: 'var(--bg-card)', padding: '20px', border: '1px solid var(--secondary-accent)', borderRadius: '8px', borderLeft: '4px solid var(--primary-accent)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong>{res.name}</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{res.date} at {res.time}</span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', fontStyle: 'italic', color: 'var(--primary-accent)' }}>"{res.requests}"</p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <span>Party: {res.party || 1}</span>
                        <span>Email: {res.email}</span>
                        <span>Phone: {res.phone || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'menu' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>Menu Management</h2>
              {menuItems.length === 0 && (
                <div className="no-data" style={{ padding: '24px', border: '2px solid var(--primary-accent)', borderRadius: 8, marginBottom: 24, background: 'rgba(212, 165, 116, 0.1)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>No menu items found!</p>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>Click below to add sample menu items that will appear on the homepage.</p>
                  <button onClick={seedFromUI} style={{ padding: '14px 32px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Add Sample Menu Items</button>
                </div>
              )}
              <div style={{ background: 'var(--bg-card)', padding: '24px', marginBottom: '32px', border: '1px solid var(--secondary-accent)' }}>
                <h3 style={{ marginBottom: '16px' }}>{editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Item Name"
                    value={editingMenuItem ? editingMenuItem.name : newMenuItem.name}
                    onChange={(e) => editingMenuItem
                      ? setEditingMenuItem({...editingMenuItem, name: e.target.value})
                      : setNewMenuItem({...newMenuItem, name: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={editingMenuItem ? editingMenuItem.price : newMenuItem.price}
                    onChange={(e) => editingMenuItem
                      ? setEditingMenuItem({...editingMenuItem, price: e.target.value})
                      : setNewMenuItem({...newMenuItem, price: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <select
                    value={editingMenuItem ? editingMenuItem.category : newMenuItem.category}
                    onChange={(e) => editingMenuItem
                      ? setEditingMenuItem({...editingMenuItem, category: e.target.value})
                      : setNewMenuItem({...newMenuItem, category: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  >
                    <option value="starters">Starters</option>
                    <option value="mains">Mains</option>
                    <option value="desserts">Desserts</option>
                    <option value="drinks">Drinks</option>
                    <option value="specials">Specials</option>
                  </select>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setSelectedImage(file);
                          setNewMenuItem({...newMenuItem, image: '' });
                        }
                      }}
                      style={{ padding: '8px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '14px' }}
                    />
                    {selectedImage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={URL.createObjectURL(selectedImage)} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{selectedImage.name}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Or paste Image URL"
                      value={newMenuItem.image}
                      onChange={(e) => {
                        setNewMenuItem({...newMenuItem, image: e.target.value});
                        setSelectedImage(null);
                      }}
                      disabled={!!selectedImage}
                      style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px', opacity: selectedImage ? 0.5 : 1 }}
                    />
                  </div>
                </div>
                <textarea
                  placeholder="Description (optional)"
                  value={editingMenuItem ? editingMenuItem.description : newMenuItem.description}
                  onChange={(e) => editingMenuItem
                    ? setEditingMenuItem({...editingMenuItem, description: e.target.value})
                    : setNewMenuItem({...newMenuItem, description: e.target.value})
                  }
                  rows={3}
                  style={{ width: '100%', padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px', marginBottom: '16px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="checkbox"
                      id="is_hidden"
                      checked={editingMenuItem ? editingMenuItem.is_hidden : newMenuItem.is_hidden}
                      onChange={(e) => editingMenuItem
                        ? setEditingMenuItem({...editingMenuItem, is_hidden: e.target.checked})
                        : setNewMenuItem({...newMenuItem, is_hidden: e.target.checked})
                      }
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="is_hidden" style={{ color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Hide from customers
                    </label>
                  </div>
                  <input
                    type="number"
                    placeholder="Stock quantity"
                    value={editingMenuItem ? editingMenuItem.stock : newMenuItem.stock}
                    onChange={(e) => editingMenuItem
                      ? setEditingMenuItem({...editingMenuItem, stock: e.target.value})
                      : setNewMenuItem({...newMenuItem, stock: e.target.value})
                    }
                    style={{ padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                </div>
                <div>
                  {editingMenuItem ? (
                    <>
                      <button 
                        onClick={handleUpdateMenuItem} 
                        style={{ padding: '12px 24px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', cursor: 'pointer', marginRight: '12px' }}
                      >
                        Update Item
                      </button>
                      <button 
                        onClick={() => setEditingMenuItem(null)} 
                        style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={handleAddMenuItem} 
                      style={{ padding: '12px 24px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', cursor: 'pointer' }}
                    >
                      Add Item
                    </button>
                  )}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--primary-accent)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedMenuItems.length === menuItems.length && menuItems.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMenuItems(menuItems.map(item => item.id));
                          } else {
                            setSelectedMenuItems([]);
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Image</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Price</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Available</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--secondary-accent)', background: selectedMenuItems.includes(item.id) ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}>
                      <td style={{ padding: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedMenuItems.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMenuItems([...selectedMenuItems, item.id]);
                            } else {
                              setSelectedMenuItems(selectedMenuItems.filter(id => id !== item.id));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        {item.image && !brokenImages[item.id] ? (
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            onError={() => setBrokenImages(prev => ({...prev, [item.id]: true}))}
                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} 
                          />
                        ) : (
                          <div style={{ width: '60px', height: '60px', background: 'var(--secondary-accent)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {item.image ? 'Bad URL' : 'No img'}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>{item.name}</td>
                      <td style={{ padding: '12px', textTransform: 'capitalize' }}>{item.category}</td>
                      <td style={{ padding: '12px' }}>${item.price?.toFixed(2)}</td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleToggleAvailability(item.id, item.is_available)}
                          style={{ 
                            padding: '6px 12px', 
                            background: item.is_available ? '#27ae60' : '#e74c3c', 
                            color: 'white', 
                            border: 'none', 
                            cursor: 'pointer', 
                            fontSize: '12px' 
                          }}
                        >
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </button>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button 
                          onClick={() => setEditingMenuItem(item)} 
                          style={{ margin: '2px', padding: '6px 12px', background: '#3498db', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => { setDeleteItemId(item.id); setShowDeleteModal(true); }} 
                          style={{ margin: '2px', padding: '6px 12px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedMenuItems.length > 0 && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e74c3c', fontWeight: '600' }}>
                    {selectedMenuItems.length} item(s) selected
                  </span>
                  <button 
                    onClick={() => setShowDeleteModal(true)}
                    style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', borderRadius: '6px' }}
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>User Access Management</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Add email addresses that will have access to the restaurant dashboard. The main admin (hamzaelsharkh@gmail.com) always has access.
              </p>
              
              <div style={{ background: 'var(--bg-card)', padding: '24px', marginBottom: '32px', border: '1px solid var(--secondary-accent)' }}>
                <h3 style={{ marginBottom: '16px' }}>Add Authorized User</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={newAuthorizedEmail}
                    onChange={(e) => setNewAuthorizedEmail(e.target.value)}
                    style={{ flex: '1', minWidth: '250px', padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', fontSize: '16px' }}
                  />
                  <button 
                    onClick={addAuthorizedEmail}
                    style={{ padding: '12px 24px', background: 'var(--primary-accent)', color: 'var(--bg-dark)', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Add User
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                <h3 style={{ marginBottom: '16px' }}>Authorized Users</h3>
                {authorizedEmails.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                    No additional users authorized. Add email addresses above to grant dashboard access.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--primary-accent)' }}>
                        <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Email</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Added Date</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authorizedEmails.map(user => (
                        <tr key={user.id} style={{ borderBottom: '1px solid var(--secondary-accent)' }}>
                          <td style={{ padding: '12px' }}>{user.email}</td>
                          <td style={{ padding: '12px' }}>{user.addedAt?.toDate ? user.addedAt.toDate().toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: '12px' }}>
                            <button 
                              onClick={() => removeAuthorizedEmail(user.id)}
                              style={{ padding: '6px 12px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(212, 165, 116, 0.1)', border: '1px solid var(--primary-accent)', borderRadius: '8px' }}>
                <p style={{ margin: 0, color: 'var(--primary-accent)', fontWeight: '600' }}>
                  Main Admin: hamzaelsharkh@gmail.com (Cannot be removed)
                </p>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>Analytics & Reports</h2>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '24px', 
                marginBottom: '32px' 
              }}>
                <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--primary-accent)' }}>Revenue Summary</h3>
                  <p style={{ fontSize: '36px', fontFamily: 'Playfair Display, serif', marginBottom: '12px' }}>
                    ${analytics.totalRevenue.toFixed(2)}
                  </p>
                  <p style={{ color: 'var(--text-secondary)' }}>From completed orders</p>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--primary-accent)' }}>Order Statistics</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Total Orders:</span>
                    <span>{orders.length}</span>
                  </div>
                  {Object.entries(analytics.orderStatusCounts).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ textTransform: 'capitalize' }}>{status.replace('_', ' ')}:</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                <h3 style={{ marginBottom: '16px', color: 'var(--primary-accent)' }}>Top 5 Popular Items</h3>
                {analytics.popularItems.map(([item, count], index) => (
                  <div 
                    key={item} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '12px', 
                      borderBottom: '1px solid rgba(255,255,255,0.1)', 
                      backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' 
                    }}
                  >
                    <span>{item}</span>
                    <span style={{ color: 'var(--primary-accent)' }}>{count} orders</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div>
              <h2 style={{ marginBottom: '24px' }}>Reports & Tools</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--primary-accent)' }}>📊 Daily Sales Report</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Summary of today's orders</p>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                      <span>Total Orders Today:</span>
                      <span style={{ fontWeight: 'bold' }}>{orders.filter(o => {
                        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : null;
                        if (!orderDate) return false;
                        const today = new Date();
                        return orderDate.toDateString() === today.toDateString();
                      }).length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                      <span>Revenue Today:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary-accent)' }}>${orders.filter(o => {
                        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : null;
                        if (!orderDate) return false;
                        const today = new Date();
                        return orderDate.toDateString() === today.toDateString() && o.status === 'completed';
                      }).reduce((sum, o) => sum + (o.total_price || o.total || 0), 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                      <span>Pending Orders:</span>
                      <span style={{ fontWeight: 'bold', color: '#f39c12' }}>{orders.filter(o => o.status === 'pending').length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                      <span>Preparing:</span>
                      <span style={{ fontWeight: 'bold', color: '#e67e22' }}>{orders.filter(o => o.status === 'preparing').length}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--primary-accent)' }}>⚠️ Low Stock Alerts</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Items that need restocking</p>
                  {menuItems.filter(item => item.stock !== undefined && item.stock < 5).length === 0 ? (
                    <p style={{ color: '#27ae60' }}>✓ All items are well stocked</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {menuItems.filter(item => item.stock !== undefined && item.stock < 5).map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '4px' }}>
                          <span style={{ color: '#e74c3c' }}>{item.name}</span>
                          <span style={{ fontWeight: 'bold' }}>{item.stock} left</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Update stock for item:</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select id="stockItemSelect" style={{ flex: 1, padding: '8px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)' }}>
                        {menuItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      <input type="number" id="stockValue" placeholder="Qty" style={{ width: '60px', padding: '8px', background: 'var(--bg-dark)', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)' }} />
                      <button onClick={() => {
                        const itemId = document.getElementById('stockItemSelect').value;
                        const newStock = document.getElementById('stockValue').value;
                        if (itemId && newStock) updateStock(itemId, newStock);
                      }} style={{ padding: '8px 16px', background: 'var(--primary-accent)', border: 'none', color: 'var(--bg-dark)', cursor: 'pointer' }}>Update</button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--secondary-accent)' }}>
                <h3 style={{ marginBottom: '16px', color: 'var(--primary-accent)' }}>🖨️ Print / Export to PDF</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Open, print, or save as PDF - works on any computer!</p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button onClick={() => printReport('Orders')} style={{ padding: '12px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Orders Report</button>
                  <button onClick={() => printReport('Customers')} style={{ padding: '12px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Customers Report</button>
                  <button onClick={() => printReport('Menu')} style={{ padding: '12px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Menu Report</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>Notifications</h2>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead} 
                    style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--primary-accent)', color: 'var(--primary-accent)', cursor: 'pointer' }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div>
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '48px' }}>No notifications yet</p>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      style={{
                        background: notif.read ? 'var(--bg-card)' : 'rgba(212, 165, 116, 0.1)',
                        padding: '16px',
                        marginBottom: '12px',
                        border: '1px solid var(--secondary-accent)',
                        cursor: 'pointer',
                        borderLeft: notif.read ? '3px solid transparent' : '3px solid var(--primary-accent)'
                      }}
                    >
                      <p style={{ marginBottom: '4px' }}>{notif.message}</p>
                      <small style={{ color: 'var(--text-muted)' }}>{new Date(notif.timestamp).toLocaleString()}</small>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)',
            padding: '32px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            border: '1px solid var(--secondary-accent)'
          }}>
            <h3 style={{ marginBottom: '16px', color: '#e74c3c' }}>Confirm Delete</h3>
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
              {(() => {
                const count = deleteType === 'menu' ? selectedMenuItems.length 
                  : deleteType === 'users' ? selectedUsers.length 
                  : deleteType === 'orders' ? selectedOrders.length 
                  : deleteType === 'reservations' ? selectedReservations.length 
                  : 0;
                const typeName = { menu: 'menu item', users: 'user', orders: 'order', reservations: 'reservation' }[deleteType];
                return deleteItemId 
                  ? `Are you sure you want to delete this ${typeName}? This action cannot be undone.`
                  : `Are you sure you want to delete ${count} ${typeName}(s)? This action cannot be undone.`;
              })()}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); setDeleteType(null); }}
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--secondary-accent)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '6px' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (deleteItemId) {
                    handleSingleDelete(deleteType, deleteItemId);
                  } else {
                    const ids = deleteType === 'menu' ? selectedMenuItems 
                      : deleteType === 'users' ? selectedUsers 
                      : deleteType === 'orders' ? selectedOrders 
                      : selectedReservations;
                    handleBulkDelete(deleteType, ids);
                  }
                }}
                style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', borderRadius: '6px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </>
  );
}

export default Dashboard;
