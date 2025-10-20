import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
                    appState.currentUser = { uid: user.uid, ...await getDoc(userRef).data() };
                }
