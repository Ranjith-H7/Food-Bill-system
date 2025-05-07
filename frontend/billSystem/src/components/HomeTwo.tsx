import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Plus, Minus, LogOut, Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface FoodItem {
  _id: string;
  name: string; 
  price: number;
  imageUrl: string;
  category: string;
  openTime: string;
  closeTime: string;
}

interface CartItem {
  item: FoodItem;
  quantity: number;
}

const API_URL = 'http://localhost:5001';

const HomeTwo: React.FC = () => {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<'Pending' | 'Successful'>('Pending');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSavedBill, setHasSavedBill] = useState<boolean>(false);
  const [hasDownloadedBill, setHasDownloadedBill] = useState<boolean>(false);
  const [isAddItemFormOpen, setIsAddItemFormOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: 0,
    openTime: '',
    closeTime: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const navigate = useNavigate();

  // Fetch food items from API
  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      const response = await axios.get(`${API_URL}/api/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFoodItems(response.data);
    } catch (error: any) {
      console.error('Error fetching items:', error);
      alert(`Failed to fetch items: ${error.response?.data?.message || error.message}`);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchItems();
  }, []);

  // Authentication check
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/');
    }
  }, [navigate]);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Categories
  const categories = useMemo(() => {
    return ['All', ...new Set(foodItems.map(item => item.category))].sort();
  }, [foodItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = selectedCategory === 'All'
      ? foodItems
      : foodItems.filter(item => item.category === selectedCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.price.toString().includes(query)
      );
    }

    return items;
  }, [selectedCategory, searchQuery, foodItems]);

  // Cart operations
  const addToCart = (item: FoodItem, quantity: number = 1) => {
    const existing = cart.find(c => c.item._id === item._id);
    if (existing) {
      setCart(cart.map(c =>
        c.item._id === item._id ? { ...c, quantity: c.quantity + quantity } : c
      ));
    } else {
      setCart([...cart, { item, quantity }]);
    }
  };

  const increaseQuantity = (itemId: string) => {
    setCart(cart.map(c =>
      c.item._id === itemId ? { ...c, quantity: c.quantity + 1 } : c
    ));
  };

  const decreaseQuantity = (itemId: string) => {
    setCart(cart
      .map(c => c.item._id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
      .filter(c => c.quantity > 0)
    );
  };

  const totalAmount = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);

  // Map frontend payment mode to backend values
  const mapPaymentMethod = (mode: string): string => {
    if (mode === 'Cash') return 'cash';
    if (mode === 'Online') return 'online';
    return 'cash'; // Default to cash if invalid
  };

  // Handle save bill to backend
  const handleSave = async () => {
    if (cart.length === 0) {
      alert('Please add items to the bill before saving.');
      return;
    }
    if (paymentMode === 'Card') {
      alert('Card payment is not supported. Please select Cash or Online.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Authentication token missing. Please log in again.');
      navigate('/');
      return;
    }
    setIsLoading(true);
    try {
      const billData = {
        items: cart.map(cartItem => ({
          itemName: cartItem.item.name,
          category: cartItem.item.category,
          price: cartItem.item.price,
          quantity: cartItem.quantity,
          total: cartItem.item.price * cartItem.quantity,
        })),
        grandTotal: totalAmount,
        paymentMethod: mapPaymentMethod(paymentMode),
        status: 'failed',
        date: new Date().toISOString(),
      };
      console.log('Sending bill data:', billData, 'Token:', token);
      const response = await axios.post(`${API_URL}/api/bill/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHasSavedBill(true);
      alert('Bill saved successfully!');
      console.log('Save bill response:', response.data);
    } catch (error: any) {
      console.error('Error saving bill:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      const errorMessage = error.response?.status === 403
        ? 'Access denied. Please log in again or contact support.'
        : error.response?.data?.error || error.message;
      alert(`Failed to save bill: ${errorMessage}`);
      if (error.response?.status === 403 || error.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle confirm payment
  const handleConfirmPayment = async () => {
    if (cart.length === 0) {
      alert('Please add items to the bill before confirming payment.');
      return;
    }
    if (paymentMode === 'Card') {
      alert('Card payment is not supported. Please select Cash or Online.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Authentication token missing. Please log in again.');
      navigate('/');
      return;
    }
    setIsLoading(true);
    try {
      const billData = {
        items: cart.map(cartItem => ({
          itemName: cartItem.item.name,
          category: cartItem.item.category,
          price: cartItem.item.price,
          quantity: cartItem.quantity,
          total: cartItem.item.price * cartItem.quantity,
        })),
        grandTotal: totalAmount,
        paymentMethod: mapPaymentMethod(paymentMode),
        status: 'success',
        date: new Date().toISOString(),
      };
      console.log('Sending bill data:', billData, 'Token:', token);
      const response = await axios.post(`${API_URL}/api/bill/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHasSavedBill(true);
      setPaymentStatus('Successful');
      alert(`Payment via ${paymentMode} successful!`);
      console.log('Confirm payment response:', response.data);
    } catch (error: any) {
      console.error('Error confirming payment:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      const errorMessage = error.response?.status === 403
        ? 'Access denied. Please log in again or contact support.'
        : error.response?.data?.error || error.message;
      alert(`Payment failed: ${errorMessage}`);
      if (error.response?.status === 403 || error.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle download bill as PDF
  const handleDownloadBill = () => {
    if (cart.length === 0) {
      alert('Please add items to the bill before downloading.');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Food Billing System - Bill', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, 40);
    doc.text(`Payment Method: ${paymentMode}`, 20, 50);
    doc.text(`Status: ${paymentStatus}`, 20, 60);

    let y = 70;
    doc.setFontSize(10);
    doc.text('Item', 20, y);
    doc.text('Qty', 100, y);
    doc.text('Price', 130, y);
    doc.text('Total', 160, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 5;

    cart.forEach((c) => {
      doc.text(c.item.name, 20, y, { maxWidth: 70 });
      doc.text(c.quantity.toString(), 100, y);
      doc.text(`₹${c.item.price}`, 130, y);
      doc.text(`₹${c.item.price * c.quantity}`, 160, y);
      y += 10;
    });

    y += 5;
    doc.line(20, y, 190, y);
    y += 10;
    doc.setFontSize(12);
    doc.text(`Grand Total: ₹${totalAmount}`, 20, y);

    doc.save(`bill_${new Date().toISOString().split('T')[0]}.pdf`);
    setHasDownloadedBill(true);
  };

  // Handle refresh items
  const handleRefresh = () => {
    fetchItems();
  };

  // Handle new bill with confirmation
  const handleNewBill = () => {
    setCart([]);
    setPaymentMode('Cash');
    setPaymentStatus('Pending');
    setHasSavedBill(false);
    setHasDownloadedBill(false);
    localStorage.removeItem('cart');
  };

  // Handle new bill button click
  const handleNewBillClick = () => {
    if (cart.length > 0 && !hasSavedBill && !hasDownloadedBill) {
      alert('Please save or download the bill before starting a new one.');
      return;
    }
    if (window.confirm('Are you sure you want to start a new bill?')) {
      handleNewBill();
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('cart');
    navigate('/');
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' ? Number(value) : value,
    }));
  };

  // Handle image file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  // Handle add new item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Authentication token missing. Please log in again.');
      navigate('/');
      return;
    }
    setIsLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('price', String(formData.price));
      formDataToSend.append('openTime', formData.openTime);
      formDataToSend.append('closeTime', formData.closeTime);
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      console.log('Sending new item data:', { ...formData, imageFile: imageFile?.name });
      await axios.post(`${API_URL}/api/items`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      // Refresh items
      await fetchItems();

      // Reset form
      setFormData({
        name: '',
        category: '',
        price: 0,
        openTime: '',
        closeTime: '',
      });
      setImageFile(null);
      setIsAddItemFormOpen(false);
      alert('Food item added successfully!');
    } catch (error: any) {
      console.error('Error adding food item:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      const errorMessage = error.response?.status === 403
        ? 'Access denied. Please log in again or contact support.'
        : error.response?.data?.error || error.message;
      alert(`Failed to add food item: ${errorMessage}`);
      if (error.response?.status === 403 || error.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-green-600 text-white p-3 flex items-center justify-between shadow-md w-full z-30 fixed top-0">
        <div className="flex items-center gap-2">
          <button
            className="sm:hidden text-white text-xl"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            ☰
          </button>
          <div className="text-lg sm:text-xl font-bold">
            Food Billing System
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="p-1.5 pl-8 rounded text-black w-full max-w-[150px] sm:max-w-[200px] border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 text-xs sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleRefresh}
            title="Refresh Items"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-1 w-full min-w-0 h-[calc(100vh-3.5rem)] pt-[3.5rem]">
        {/* Sidebar */}
        <aside
          className={`fixed sm:static top-[3.5rem] left-0 h-[calc(100vh-3.5rem)] w-56 bg-gray-100 p-3 overflow-y-auto border-r border-gray-200 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0 z-20`}
        >
          <h2 className="text-base font-semibold mb-3 text-gray-800 ml-1">Categories</h2>
          <ul className="space-y-1 mb-3">
            {categories.map((category) => (
              <li
                key={category}
                className={`cursor-pointer w-full px-2 py-1.5 rounded text-sm transition-all ${selectedCategory === category ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                onClick={() => {
                  setSelectedCategory(category);
                  setIsSidebarOpen(false);
                }}
              >
                {category}
              </li>
            ))}
          </ul>
          {/* Add New Item Form */}
          <div className="mb-3">
            <button
              className="w-full px-2 py-1.5 bg-indigo-600 text-white rounded text-sm flex items-center justify-between hover:bg-indigo-700"
              onClick={() => setIsAddItemFormOpen(!isAddItemFormOpen)}
            >
              <span>Add New Item</span>
              {isAddItemFormOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {isAddItemFormOpen && (
              <form onSubmit={handleAddItem} className="mt-2 space-y-2">
                <div>
                  <label className="block text-xs text-gray-700">Name*</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-1 border rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700">Category*</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full p-1 border rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700">Price (₹)*</label>
                  <input
                    type="number"
                    name="price"
                    min="1"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full p-1 border rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700">Open Time*</label>
                  <input
                    type="text"
                    name="openTime"
                    value={formData.openTime}
                    onChange={handleInputChange}
                    placeholder="9:00 AM"
                    className="w-full p-1 border rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700">Close Time*</label>
                  <input
                    type="text"
                    name="closeTime"
                    value={formData.closeTime}
                    onChange={handleInputChange}
                    placeholder="10:00 PM"
                    className="w-full p-1 border rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full p-1 border rounded text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full px-2 py-1.5 text-white rounded text-sm ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {isLoading ? 'Adding...' : 'Add Item'}
                </button>
              </form>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-2 py-1.5 bg-red-500 text-white rounded text-sm shadow hover:bg-red-600 ml-1 flex items-center justify-center"
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </button>
        </aside>

        {/* Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 sm:hidden z-10"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* Main Section */}
        <main className="flex-1 p-3 overflow-y-auto bg-white min-w-0 h-[calc(100vh-3.5rem)]">
          <h1 className="text-xl font-bold mb-3 ml-1">Menu</h1>
          {filteredItems.length === 0 ? (
            <div className="text-gray-400 text-center mt-5">
              No items found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map((item) => {
                const cartItem = cart.find((c) => c.item._id === item._id);
                const quantity = cartItem ? cartItem.quantity : 0;

                return (
                  <div
                    key={item._id}
                    className="shadow rounded overflow-hidden bg-white border border-gray-300"
                  >
                    <div className="w-full h-32 flex items-center justify-center">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="max-w-full max-h-full object-cover object-center"
                        onError={(e) => {
                          e.currentTarget.src = '/images/placeholder.jpg';
                        }}
                      />
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-gray-800 line-clamp-2 ml-1">
                          {item.name}
                        </span>
                        <span className="text-xs text-gray-600 font-medium">
                          ₹{item.price}
                        </span>
                      </div>
                      <div className="flex items-center justify-end">
                        {quantity === 0 ? (
                          <button
                            className="px-2 py-1 bg-teal-500 text-white rounded text-xs shadow hover:bg-teal-600"
                            onClick={() => addToCart(item)}
                          >
                            Add
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 mr-1">
                            <button
                              className="w-5 h-5 flex items-center justify-center bg-red-500 text-white rounded text-xs shadow-sm hover:bg-red-600"
                              onClick={() => decreaseQuantity(item._id)}
                            >
                              -
                            </button>
                            <span className="w-5 text-center text-xs font-medium">
                              {quantity}
                            </span>
                            <button
                              className="w-5 h-5 flex items-center justify-center bg-green-500 text-white rounded text-xs shadow-sm hover:bg-green-600"
                              onClick={() => increaseQuantity(item._id)}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Billing Section */}
        <aside className="w-full sm:w-80 bg-gray-100 p-3 flex flex-col border-t sm:border-t-0 sm:border-l border-gray-200 overflow-y-auto h-[calc(100vh-3.5rem)]">
          <div className="flex-grow">
            <h2 className="text-base font-semibold mb-3 text-gray-800 ml-1">Billing</h2>
            <button
              className="w-full px-2 py-1.5 bg-purple-600 text-white rounded text-sm shadow hover:bg-purple-700 mb-3"
              onClick={handleNewBillClick}
            >
              New Bill
            </button>
            {cart.length === 0 ? (
              <p className="text-gray-500 text-xs text-center">No items added.</p>
            ) : (
              <div className="w-full">
                <div className="bg-white p-3 rounded shadow mb-3">
                  <div className="flex font-semibold text-gray-700 mb-1 text-xs">
                    <span className="w-2/5 pl-1">Item</span>
                    <span className="w-1/5 text-center">Qty</span>
                    <span className="w-1/5 text-right">Rate</span>
                    <span className="w-1/5 text-right">Amount</span>
                  </div>
                  {cart.map((c) => (
                    <div
                      key={c.item._id}
                      className="flex items-center text-gray-600 mb-1 text-xs"
                    >
                      <span className="w-2/5 truncate line-clamp-1 pl-1">{c.item.name}</span>
                      <div className="w-1/5">
                        <div className="flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 rounded px-1 py-0.5">
                          <button
                            className="w-5 h-5 flex items-center justify-center bg-red-500 text-white rounded text-xs shadow-sm hover:bg-red-600"
                            onClick={() => decreaseQuantity(c.item._id)}
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-xs font-medium">{c.quantity}</span>
                          <button
                            className="w-5 h-5 flex items-center justify-center bg-green-500 text-white rounded text-xs shadow-sm hover:bg-green-600"
                            onClick={() => increaseQuantity(c.item._id)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <span className="w-1/5 text-right">₹{c.item.price}</span>
                      <span className="w-1/5 text-right">₹{c.item.price * c.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-300 pt-1 mt-1">
                    <div className="flex justify-between font-semibold text-gray-800 text-xs">
                      <span>Subtotal:</span>
                      <span>₹{totalAmount}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-gray-800 mt-0.5">
                      <span>Total:</span>
                      <span>₹{totalAmount}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs text-gray-700 ml-1">Payment:</label>
                    <select
                      className="p-1 rounded text-black w-full border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      disabled={paymentStatus === 'Successful' || isLoading}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                  {paymentMode === 'Online' && (
                    <div className="flex justify-center mt-2 mb-2">
                      <img
                        src="/online/online.png"
                        alt="Online Payment QR Code"
                        className="w-32 h-32 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = '/images/placeholder.jpg';
                        }}
                      />
                    </div>
                  )}
                  <div className="text-xs text-gray-700 mb-1 ml-1">
                    Status: <span className={paymentStatus === 'Successful' ? 'text-green-600' : 'text-yellow-600'}>{paymentStatus}</span>
                  </div>
                  {paymentStatus !== 'Successful' && (
                    <button
                      className={`w-full px-2 py-1.5 bg-blue-600 text-white rounded text-sm shadow hover:bg-blue-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleConfirmPayment}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Processing...' : 'Confirm Payment'}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1 mt-3">
                  <button
                    className={`w-full px-2 py-1.5 bg-blue-600 text-white rounded text-sm shadow hover:bg-blue-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleSave}
                    disabled={isLoading}
                  >
                    Save Bill
                  </button>
                  <button
                    className={`w-full px-2 py-1.5 bg-green-600 text-white rounded text-sm shadow hover:bg-green-600 flex items-center justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleDownloadBill}
                    disabled={isLoading}
                  >
                    <Download size={16} className="mr-2" />
                    Download Bill
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default HomeTwo;