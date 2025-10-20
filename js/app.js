import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc, writeBatch, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);
const provider = new GoogleAuthProvider();

// --- STATE & UI ELEMENTS ---
const appState = {
    currentUser: null, canteens: [], dishes: [], cart: [],
    orders: [], currentView: 'ftArenaView', historyStack: ['ftArenaView'],
};

const ui = {
    loginPage: document.getElementById('loginPage'),
    appContainer: document.getElementById('appContainer'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userName: document.getElementById('userName'),
    cartCount: document.getElementById('cartCount'),
    canteenList: document.getElementById('canteenList'),
    canteenMenuPage: document.getElementById('canteenMenuPage'),
    canteenMenuHeader: document.getElementById('canteenMenuHeader'),
    canteenMenuItems: document.getElementById('canteenMenuItems'),
    dishDetailsPage: document.getElementById('dishDetailsPage'),
    dishDetailHeader: document.getElementById('dishDetailHeader'),
    dishDetailCanteenList: document.getElementById('dishDetailCanteenList'),
    cartItemsContainer: document.getElementById('cartItemsContainer'),
    paymentSummary: document.getElementById('paymentSummary'),
    buyNowBurger: document.getElementById('buyNowBurger'),
    currentOrdersContainer: document.getElementById('currentOrdersContainer'),
    pastOrdersContainer: document.getElementById('pastOrdersContainer'),
    orderDate: document.getElementById('orderDate'),
    toast: document.getElementById('toast'),
    bottomNavItems: document.querySelectorAll('.bottom-nav .nav-item'),
    sideNav: document.getElementById('sideNav'),
    navOverlay: document.getElementById('navOverlay'),
};

// --- CORE APP LOGIC ---
const app = {
    init() {
        this.setupEventListeners();
        this.handleAuthState();
    },

    setupEventListeners() {
        ui.loginBtn.addEventListener('click', this.signIn);
        ui.logoutBtn.addEventListener('click', this.signOut);
        ui.buyNowBurger.addEventListener('click', () => this.animateAndPlaceOrder());
        ui.bottomNavItems.forEach(item => {
            item.addEventListener('click', () => this.switchView(item.dataset.view));
        });
    },

    handleAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    const newUserId = Math.random().toString(36).substring(2, 8).toUpperCase();
                    await setDoc(userRef, {
                        email: user.email, name: user.displayName, userId: newUserId,
                    });
                    appState.currentUser = { uid: user.uid, ...(await getDoc(userRef)).data() };
                } else {
                    appState.currentUser = { uid: user.uid, ...userSnap.data() };
                }
                this.showApp();
            } else { this.showLogin(); }
        });
    },
    
    signIn() { signInWithPopup(auth, provider).catch(e => console.error("Sign-in failed", e)); },
    signOut() { signOut(auth); },

    showLogin() {
        ui.loginPage.classList.add('active');
        ui.appContainer.classList.remove('active');
    },

    showApp() {
        ui.loginPage.classList.remove('active');
        ui.appContainer.classList.add('active');
        ui.userName.textContent = appState.currentUser.name;
        this.listenToCanteens();
        this.listenToOrders();
    },
    
    listenToCanteens() {
        onSnapshot(collection(db, "canteens"), (snapshot) => {
            appState.canteens = [];
            appState.dishes = [];
            snapshot.forEach(doc => {
                const canteenData = { id: doc.id, ...doc.data() };
                if (canteenData.isOpen) {
                    appState.canteens.push(canteenData);
                    (canteenData.dishes || []).forEach(dish => {
                        if ('isAvailable' in dish ? dish.isAvailable : true) {
                            appState.dishes.push({ ...dish, canteenId: canteenData.id, canteenName: canteenData.name });
                        }
                    });
                }
            });
            this.renderAll();
        });
    },

    listenToOrders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const q = query(collection(db, "orders"), where("uid", "==", appState.currentUser.uid), where("createdAt", ">=", today));
        onSnapshot(q, (snapshot) => {
            appState.orders = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
            this.renderOrders();
        });
    },
    
    // --- MOCK PAYMENT & ORDER PLACEMENT ---
    animateAndPlaceOrder() {
        if (appState.cart.length === 0) return;

        // Animate the burger button exactly as requested
        const burger = ui.buyNowBurger;
        const tomato = burger.querySelector('.tomato');
        
        burger.classList.add('show');
        tomato.classList.add('tap-bounce');
        
        setTimeout(() => tomato.classList.remove('tap-bounce'), 400);
        setTimeout(() => burger.classList.remove('show'), 2500);

        // Immediately run the payment success logic
        this.handleSuccessfulPayment();
    },

    async handleSuccessfulPayment() {
  const eatingMode = document.querySelector('input[name="eatingMode"]:checked').value;
  const batch = writeBatch(db);
  
  const ordersByCanteen = appState.cart.reduce((acc, item) => {
    acc[item.canteenId] = acc[item.canteenId] || [];
    acc[item.canteenId].push(item);
    return acc;
  }, {});

  for (const canteenId in ordersByCanteen) {
    const orderRef = doc(collection(db, "orders"));
    const itemsForCanteen = ordersByCanteen[canteenId];
    const canteenTotal = itemsForCanteen.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    batch.set(orderRef, {
      uid: appState.currentUser.uid,
      userId: appState.currentUser.userId,
      canteenId,
      items: itemsForCanteen,
      total: canteenTotal,
      eatingMode,
      status: 'Paid',
      createdAt: new Date(),
    });
  }

  await batch.commit();

  appState.cart = [];
  this.renderCart();
  this.showToast('Order Placed Successfully!');
  this.showPage('ordersPage');
}

        
        await batch.commit();
        
        appState.cart = [];
        this.renderCart();
        this.showToast('Order Placed Successfully!');
        this.showPage('ordersPage');
    },
        
        await batch.commit();
        
        appState.cart = [];
        this.renderCart();
        this.showToast('Order Placed Successfully!');
        this.showPage('ordersPage');
    },

    renderAll() { this.renderCanteenList(); },
    renderCanteenList() { /* ... function code (no changes) ... */ },
    showCanteenMenu(canteenId) { /* ... function code (no changes) ... */ },
    showDishDetails(dishName) { /* ... function code (no changes) ... */ },
    createDishCard(dish) { /* ... function code (no changes) ... */ },
    addToCart(dish) { /* ... function code (no changes) ... */ },
    renderCart() { /* ... function code (no changes) ... */ },
    updateQuantity(index, change) { /* ... function code (no changes) ... */ },
    calculateTotal() { /* ... function code (no changes) ... */ },
    renderOrders() { /* ... function code (no changes) ... */ },
    createOrderCard(order) { /* ... function code (no changes) ... */ },
    switchView(viewId) { /* ... function code (no changes) ... */ },
    showPage(pageId) { /* ... function code (no changes) ... */ },
    goBack() { /* ... function code (no changes) ... */ },
    toggleSideNav() { /* ... function code (no changes) ... */ },
    closeSideNav() { /* ... function code (no changes) ... */ },
    showToast(message) { /* ... function code (no changes) ... */ },
};

// --- HELPER FUNCTIONS (No changes needed) ---
app.renderCanteenList = function() {
    ui.canteenList.innerHTML = '';
    appState.canteens.forEach(canteen => {
        const card = document.createElement('div');
        card.className = 'canteen-card';
        card.innerHTML = `<img src="${canteen.imageUrl}" alt="${canteen.name}"><div class="canteen-info">${canteen.name}</div><div class="status-tag ${canteen.isOpen ? '' : 'closed'}">${canteen.isOpen ? 'OPEN' : 'CLOSED'}</div>`;
        card.onclick = () => this.showCanteenMenu(canteen.id);
        ui.canteenList.appendChild(card);
    });
};
app.showCanteenMenu = function(canteenId) {
    const canteen = appState.canteens.find(c => c.id === canteenId);
    ui.canteenMenuHeader.innerHTML = `<img src="${canteen.imageUrl}" alt="${canteen.name}"><h2>${canteen.name}</h2>`;
    ui.canteenMenuItems.innerHTML = '';
    const canteenDishes = appState.dishes.filter(d => d.canteenId === canteenId);
    canteenDishes.forEach(dish => {
        const card = this.createDishCard(dish);
        ui.canteenMenuItems.appendChild(card);
    });
    this.showPage('canteenMenuPage');
};
app.showDishDetails = function(dishName) {
    const sameDishes = appState.dishes.filter(d => d.name === dishName);
    if (sameDishes.length === 0) return;
    const mainDish = sameDishes[0];
    ui.dishDetailHeader.innerHTML = `<img src="${mainDish.imageUrl}" alt="${mainDish.name}"><h2>${mainDish.name}</h2>`;
    ui.dishDetailCanteenList.innerHTML = '';
    sameDishes.forEach(dish => {
        const item = document.createElement('div');
        item.className = 'canteen-price-item';
        item.innerHTML = `<span>${dish.canteenName}</span><button class="add-cart-btn">₹${dish.price} <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></button>`;
        item.querySelector('.add-cart-btn').onclick = () => this.addToCart(dish);
        ui.dishDetailCanteenList.appendChild(item);
    });
    this.showPage('dishDetailsPage');
};
app.createDishCard = function(dish) {
    const card = document.createElement('div');
    card.className = 'dish-card';
    card.innerHTML = `<img src="${dish.imageUrl}" alt="${dish.name}"><div class="price-tag">₹${dish.price}</div><div class="dish-info"><span class="dish-name">${dish.name}</span><button class="add-cart-btn">Add <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></button></div>`;
    card.onclick = () => this.showDishDetails(dish.name);
    card.querySelector('.add-cart-btn').onclick = (e) => { e.stopPropagation(); this.addToCart(dish); };
    return card;
};
app.addToCart = function(dish) {
    const existingItem = appState.cart.find(item => item.id === dish.id && item.canteenId === dish.canteenId);
    if (existingItem) existingItem.quantity++;
    else appState.cart.push({ ...dish, quantity: 1, notes: '' });
    this.showToast(`${dish.name} added to cart!`);
    this.renderCart();
};
app.renderCart = function() {
    ui.cartCount.textContent = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    ui.cartItemsContainer.innerHTML = '';
    if (appState.cart.length === 0) { ui.cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>'; }
    appState.cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<img src="${item.imageUrl}" alt="${item.name}"><div class="cart-item-details"><p class="cart-item-title">${item.name}</p><p class="cart-item-canteen">From: ${item.canteenName}</p><input type="text" class="cart-item-notes" placeholder="Add Notes..." value="${item.notes}"></div><div class="quantity-stepper"><button class="quantity-btn plus">+</button><span>${item.quantity}</span><button class="quantity-btn minus">-</button></div>`;
        div.querySelector('.plus').onclick = () => this.updateQuantity(index, 1);
        div.querySelector('.minus').onclick = () => this.updateQuantity(index, -1);
        div.querySelector('.cart-item-notes').onchange = (e) => item.notes = e.target.value;
        ui.cartItemsContainer.appendChild(div);
    });
    this.calculateTotal();
};
app.updateQuantity = function(index, change) {
    appState.cart[index].quantity += change;
    if (appState.cart[index].quantity <= 0) appState.cart.splice(index, 1);
    this.renderCart();
};
app.calculateTotal = function() {
    const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const gatewayFee = subtotal > 0 ? 5 : 0;
    const platformFee = subtotal > 0 ? 2 : 0;
    const total = subtotal + gatewayFee + platformFee;
    ui.paymentSummary.innerHTML = `<div class="payment-item"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div><div class="payment-item"><span>Gateway Fee</span><span>₹${gatewayFee.toFixed(2)}</span></div><div class="payment-item"><span>Platform Fee</span><span>₹${platformFee.toFixed(2)}</span></div><div class="payment-item total"><span>TOTAL</span><span>₹${total.toFixed(2)}</span></div>`;
};
app.renderOrders = function() {
    ui.orderDate.textContent = new Date().toLocaleDateString('en-GB');
    ui.currentOrdersContainer.innerHTML = '';
    ui.pastOrdersContainer.innerHTML = '';
    const currentOrders = appState.orders.filter(o => o.status !== 'Completed');
    const pastOrders = appState.orders.filter(o => o.status === 'Completed');
    if (currentOrders.length > 0) {
        ui.currentOrdersContainer.innerHTML = '<h3 class="order-group-title">CURRENT ORDERS</h3>';
        currentOrders.forEach(order => ui.currentOrdersContainer.appendChild(this.createOrderCard(order)));
    }
    if (pastOrders.length > 0) {
        ui.pastOrdersContainer.innerHTML = '<h3 class="order-group-title">PAST ORDERS</h3>';
        pastOrders.forEach(order => ui.pastOrdersContainer.appendChild(this.createOrderCard(order)));
    }
};
app.createOrderCard = function(order) {
    const card = document.createElement('div');
    card.className = 'order-card';
    const itemsSummary = order.items.map(item => `${item.quantity}x ${item.name}`).join('<br>');
    const hasVeg = order.items.some(item => item.isVeg);
    const hasNonVeg = order.items.some(item => !item.isVeg);
    card.innerHTML = `<div class="order-info-header"><span>ID: ${order.userId}</span><span>₹${order.total.toFixed(2)}</span></div><p class="order-items">${itemsSummary}</p><div class="order-meta"><div class="veg-indicator-container">${hasVeg ? '<div class="veg-indicator veg"></div>' : ''}${hasNonVeg ? '<div class="veg-indicator non-veg"></div>' : ''}</div><div class="tick-container"><div class="tick ${['Paid', 'Ready', 'VerifiedByOwner', 'Completed'].includes(order.status) ? 'active' : ''}">✓</div><div class="tick ${['Ready', 'VerifiedByOwner', 'Completed'].includes(order.status) ? 'active' : ''}">✓</div><div class="tick ${['Completed'].includes(order.status) ? 'active' : ''}">✓</div></div><div class="order-type-icon ${order.eatingMode}">${order.eatingMode.charAt(0).toUpperCase()}</div></div><div class="order-footer">${order.status === 'VerifiedByOwner' ? `<button class="btn-complete">COMPLETED</button>` : ''}${order.status === 'Completed' ? `<span class="completed-text">COMPLETED</span>` : ''}</div>`;
    if (order.status === 'VerifiedByOwner') {
        card.querySelector('.btn-complete').onclick = async () => {
            await updateDoc(doc(db, "orders", order.id), { status: 'Completed' });
            this.showToast('Order marked as complete!');
        };
    }
    return card;
};
app.switchView = function(viewId) {
    document.querySelectorAll('#mainPage .view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    ui.bottomNavItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewId));
    appState.currentView = viewId;
    this.closeSideNav();
};
app.showPage = function(pageId) {
    document.querySelectorAll('.content-container > .page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if (!appState.historyStack.includes(pageId)) appState.historyStack.push(pageId);
    this.closeSideNav();
};
app.goBack = function() {
    appState.historyStack.pop();
    const previousPage = appState.historyStack.length > 0 ? appState.historyStack[appState.historyStack.length - 1] : 'mainPage';
    document.querySelectorAll('.content-container > .page').forEach(p => p.classList.remove('active'));
    document.getElementById(previousPage).classList.add('active');
};
app.toggleSideNav = function() {
    ui.sideNav.classList.toggle('open');
    ui.navOverlay.classList.toggle('visible');
};
app.closeSideNav = function() {
    ui.sideNav.classList.remove('open');
    ui.navOverlay.classList.remove('visible');
};
app.showToast = function(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    setTimeout(() => ui.toast.classList.remove('show'), 3000);
};

window.app = app;
app.init();
