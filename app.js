// GIVEGOOD App Controller

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    const state = {
        currentUser: null,
        currentView: 'home',
        activeChatContact: null,
        chatPollInterval: null,
        contactsPollInterval: null,
        pendingVerifyEmail: '',
        pendingChatTarget: null
    };

    // DOM Elements
    const elements = {
        // Nav Links
        logoLink: document.getElementById('nav-logo'),
        linkHome: document.getElementById('link-home'),
        linkBrowse: document.getElementById('link-browse'),
        linkDonate: document.getElementById('link-donate'),
        linkChat: document.getElementById('link-chat'),
        chatUnreadBadge: document.getElementById('chat-unread-badge'),
        menuToggle: document.getElementById('menu-toggle'),
        navMenu: document.getElementById('nav-menu'),
        
        // Nav Auth
        navGuest: document.getElementById('auth-nav-guest'),
        navUser: document.getElementById('auth-nav-user'),
        navUserName: document.getElementById('nav-user-name'),
        linkLogin: document.getElementById('link-login'),
        linkRegister: document.getElementById('link-register'),
        btnLogout: document.getElementById('btn-logout'),

        // View Sections
        views: {
            home: document.getElementById('view-home'),
            auth: document.getElementById('view-auth'),
            browse: document.getElementById('view-browse'),
            detail: document.getElementById('view-item-detail'),
            donate: document.getElementById('view-donate'),
            chat: document.getElementById('view-chat')
        },

        // Home View Buttons
        heroBtnDonate: document.getElementById('hero-btn-donate'),
        heroBtnBrowse: document.getElementById('hero-btn-browse'),
        homeItemsGrid: document.getElementById('home-items-grid'),
        categoryItems: document.querySelectorAll('.category-item'),

        // Auth Cards
        cardLogin: document.getElementById('card-login'),
        cardRegister: document.getElementById('card-register'),
        cardVerify: document.getElementById('card-verify'),
        
        // Auth Forms & Alerts
        formLogin: document.getElementById('form-login'),
        formRegister: document.getElementById('form-register'),
        formVerify: document.getElementById('form-verify'),
        loginEmail: document.getElementById('login-email'),
        loginPassword: document.getElementById('login-password'),
        registerName: document.getElementById('register-name'),
        registerEmail: document.getElementById('register-email'),
        registerPassword: document.getElementById('register-password'),
        verifyCode: document.getElementById('verify-code'),
        verifyEmailDisplay: document.getElementById('verify-email-display'),
        simulatedCodeValue: document.getElementById('simulated-code-value'),
        loginError: document.getElementById('login-error'),
        registerError: document.getElementById('register-error'),
        verifyError: document.getElementById('verify-error'),
        toRegister: document.getElementById('to-register'),
        toLogin: document.getElementById('to-login'),
        verifyBackToRegister: document.getElementById('verify-back-to-register'),

        // Browse / Listings
        browseSearchInput: document.getElementById('browse-search-input'),
        browseSearchBtn: document.getElementById('browse-search-btn'),
        resultsCount: document.getElementById('results-count'),
        browseItemsGrid: document.getElementById('browse-items-grid'),
        filterBtns: document.querySelectorAll('.filter-btn'),

        // Detail View
        detailContent: document.getElementById('item-detail-content'),
        btnDetailBack: document.getElementById('btn-detail-back'),

        // Donate Form
        formDonate: document.getElementById('form-donate'),
        donateTitle: document.getElementById('donate-title'),
        donateCategory: document.getElementById('donate-category'),
        donateDescription: document.getElementById('donate-description'),
        donateImage: document.getElementById('donate-image'),
        imageUploadArea: document.getElementById('image-upload-area'),
        imagePreviewContainer: document.getElementById('image-preview-container'),
        imagePreview: document.getElementById('image-preview'),
        btnRemovePreview: document.getElementById('btn-remove-preview'),
        donateError: document.getElementById('donate-error'),
        donateSuccess: document.getElementById('donate-success'),

        // Chat
        chatContactsList: document.getElementById('chat-contacts-list'),
        chatWelcomeScreen: document.getElementById('chat-welcome-screen'),
        chatActiveScreen: document.getElementById('chat-active-screen'),
        chatActiveName: document.getElementById('chat-active-name'),
        chatActiveEmail: document.getElementById('chat-active-email'),
        chatMessagesContainer: document.getElementById('chat-messages-container'),
        formChatSend: document.getElementById('form-chat-send'),
        chatMessageInput: document.getElementById('chat-message-input')
    };

    // Filter configuration
    let currentCategoryFilter = '';
    let currentSearchQuery = '';

    // --- NAVIGATION / ROUTER ---

    function switchView(viewName) {
        // Clean up active polling if leaving chat
        if (viewName !== 'chat') {
            stopChatPolling();
            stopContactsPolling();
        } else {
            startContactsPolling();
        }

        // Collapse mobile menu if open
        elements.navMenu.classList.remove('show');

        // Check view restriction
        if ((viewName === 'donate' || viewName === 'chat') && !state.currentUser) {
            elements.loginError.style.display = 'none';
            elements.loginEmail.value = '';
            elements.loginPassword.value = '';
            showAuthCard('login');
            switchView('auth');
            return;
        }

        state.currentView = viewName;

        // Toggle visibility
        Object.keys(elements.views).forEach(key => {
            if (key === viewName) {
                elements.views[key].classList.add('active');
            } else {
                elements.views[key].classList.remove('active');
            }
        });

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.getElementById(`link-${viewName}`);
        if (activeLink) activeLink.classList.add('active');

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Trigger view load events
        if (viewName === 'home') {
            loadHomeItems();
        } else if (viewName === 'browse') {
            applyBrowseFilters();
        } else if (viewName === 'chat') {
            loadChatContacts();
        }
    }

    function showAuthCard(cardType) {
        elements.cardLogin.style.display = cardType === 'login' ? 'block' : 'none';
        elements.cardRegister.style.display = cardType === 'register' ? 'block' : 'none';
        elements.cardVerify.style.display = cardType === 'verify' ? 'block' : 'none';
        
        elements.loginError.style.display = 'none';
        elements.registerError.style.display = 'none';
        elements.verifyError.style.display = 'none';
    }

    // Toggle Mobile Navbar
    elements.menuToggle.addEventListener('click', () => {
        elements.navMenu.classList.toggle('show');
    });

    // Navigation Event Listeners
    elements.logoLink.addEventListener('click', (e) => { e.preventDefault(); switchView('home'); });
    elements.linkHome.addEventListener('click', (e) => { e.preventDefault(); switchView('home'); });
    elements.linkBrowse.addEventListener('click', (e) => { e.preventDefault(); switchView('browse'); });
    elements.linkDonate.addEventListener('click', (e) => { e.preventDefault(); switchView('donate'); });
    elements.linkChat.addEventListener('click', (e) => { e.preventDefault(); switchView('chat'); });
    
    elements.linkLogin.addEventListener('click', (e) => { e.preventDefault(); showAuthCard('login'); switchView('auth'); });
    elements.linkRegister.addEventListener('click', (e) => { e.preventDefault(); showAuthCard('register'); switchView('auth'); });
    
    elements.toRegister.addEventListener('click', (e) => { e.preventDefault(); showAuthCard('register'); });
    elements.toLogin.addEventListener('click', (e) => { e.preventDefault(); showAuthCard('login'); });
    elements.verifyBackToRegister.addEventListener('click', (e) => { e.preventDefault(); showAuthCard('register'); });

    elements.heroBtnDonate.addEventListener('click', () => switchView('donate'));
    elements.heroBtnBrowse.addEventListener('click', () => switchView('browse'));

    // Toggle Password Visibility (Eye Icon)
    setupPasswordToggle('toggle-login-pwd', 'login-password');
    setupPasswordToggle('toggle-register-pwd', 'register-password');

    function setupPasswordToggle(toggleId, inputId) {
        const toggleIcon = document.getElementById(toggleId);
        const passwordInput = document.getElementById(inputId);
        
        if (toggleIcon && passwordInput) {
            toggleIcon.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                
                toggleIcon.classList.toggle('fa-eye');
                toggleIcon.classList.toggle('fa-eye-slash');
            });
        }
    }

    // --- AUTHENTICATION LOGIC ---

    async function checkAuth() {
        try {
            const data = await API.getCurrentUser();
            if (data.user) {
                state.currentUser = data.user;
                updateAuthNavbar();
            } else {
                state.currentUser = null;
                updateAuthNavbar();
            }
        } catch (err) {
            console.error('Auth verification error:', err);
        }
    }

    function updateAuthNavbar() {
        if (state.currentUser) {
            elements.navGuest.style.display = 'none';
            elements.navUser.style.display = 'flex';
            elements.linkChat.style.display = 'flex';
            elements.navUserName.textContent = state.currentUser.name;
            startContactsPolling();
        } else {
            elements.navGuest.style.display = 'flex';
            elements.navUser.style.display = 'none';
            elements.linkChat.style.display = 'none';
            stopContactsPolling();
        }
    }

    // Register Form Submit
    elements.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.registerError.style.display = 'none';
        
        const name = elements.registerName.value.trim();
        const email = elements.registerEmail.value.trim();
        const password = elements.registerPassword.value;
        
        try {
            const data = await API.register(name, email, password);
            state.pendingVerifyEmail = email;
            elements.verifyEmailDisplay.textContent = email;
            
            // Verification Code Simulator helper
            if (data.debug_code) {
                elements.simulatedCodeValue.textContent = data.debug_code;
            } else {
                elements.simulatedCodeValue.textContent = '------';
            }
            
            showAuthCard('verify');
        } catch (err) {
            elements.registerError.textContent = err.message;
            elements.registerError.style.display = 'flex';
        }
    });

    // Verify Email Form Submit
    elements.formVerify.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.verifyError.style.display = 'none';
        
        const code = elements.verifyCode.value.trim();
        
        try {
            const data = await API.verify(state.pendingVerifyEmail, code);
            state.currentUser = data.user;
            updateAuthNavbar();
            
            // Reset fields
            elements.registerName.value = '';
            elements.registerEmail.value = '';
            elements.registerPassword.value = '';
            elements.verifyCode.value = '';
            
            if (state.pendingChatTarget) {
                const target = state.pendingChatTarget;
                state.pendingChatTarget = null;
                startChatWithUser(target.id, target.name, target.email);
            } else {
                switchView('home');
            }
        } catch (err) {
            elements.verifyError.textContent = err.message;
            elements.verifyError.style.display = 'flex';
        }
    });

    // Login Form Submit
    elements.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.loginError.style.display = 'none';
        
        const email = elements.loginEmail.value.trim();
        const password = elements.loginPassword.value;
        
        try {
            const data = await API.login(email, password);
            state.currentUser = data.user;
            updateAuthNavbar();
            
            elements.loginEmail.value = '';
            elements.loginPassword.value = '';
            
            if (state.pendingChatTarget) {
                const target = state.pendingChatTarget;
                state.pendingChatTarget = null;
                startChatWithUser(target.id, target.name, target.email);
            } else {
                switchView('home');
            }
        } catch (err) {
            if (err.message.includes('ยังไม่ได้ยืนยันตัวตน') || err.message.includes('not_verified')) {
                // If account not verified, show verify screen
                state.pendingVerifyEmail = email;
                elements.verifyEmailDisplay.textContent = email;
                
                // Read debug code if present in console error dump
                elements.simulatedCodeValue.textContent = 'โปรดตรวจสอบรหัสผ่านใน Terminal / Log';
                showAuthCard('verify');
            } else {
                elements.loginError.textContent = err.message;
                elements.loginError.style.display = 'flex';
            }
        }
    });

    // Logout Click
    elements.btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await API.logout();
            state.currentUser = null;
            updateAuthNavbar();
            switchView('home');
        } catch (err) {
            console.error('Logout error:', err);
        }
    });


    // --- ITEMS LISTINGS LOGIC ---

    function createItemCardHTML(item) {
        const statusText = item.status === 'available' ? 'พร้อมส่งต่อ' : (item.status === 'requested' ? 'มีผู้ขอรับแล้ว' : 'บริจาคแล้ว');
        const statusClass = `status-${item.status}`;
        
        const dateStr = new Date(item.created_at).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1544027983-15c82c6569d9?w=500&auto=format&fit=crop&q=60';

        return `
            <div class="item-card" data-id="${item.id}">
                <div class="card-image-wrapper">
                    <img src="${imgUrl}" alt="${item.title}" loading="lazy">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="card-content">
                    <span class="card-category">${item.category}</span>
                    <h3 class="card-title">${item.title}</h3>
                    <p class="card-desc">${item.description}</p>
                    <div class="card-footer">
                        <div class="donor-info">
                            <div class="donor-avatar"><i class="fa-solid fa-user"></i></div>
                            <span>${item.donor_name}</span>
                        </div>
                        <button class="btn btn-primary btn-sm btn-card-view">ดูรายละเอียด</button>
                    </div>
                </div>
            </div>
        `;
    }

    async function loadHomeItems() {
        try {
            const items = await API.getItems();
            // Show only first 6 recent items on home
            const recentItems = items.slice(0, 6);
            
            if (recentItems.length === 0) {
                elements.homeItemsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-box-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom:12px;"></i>
                        <p>ยังไม่มีของบริจาคในระบบขณะนี้</p>
                    </div>
                `;
                return;
            }

            elements.homeItemsGrid.innerHTML = recentItems.map(createItemCardHTML).join('');
            setupCardClickListeners();
        } catch (err) {
            elements.homeItemsGrid.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}</div>`;
        }
    }

    async function applyBrowseFilters() {
        elements.browseItemsGrid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> กำลังโหลดข้อมูล...</div>';
        
        try {
            const items = await API.getItems(currentCategoryFilter, currentSearchQuery);
            elements.resultsCount.textContent = `พบสิ่งของทั้งหมด ${items.length} รายการ`;
            
            if (items.length === 0) {
                elements.browseItemsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom:12px;"></i>
                        <p>ไม่พบรายการของบริจาคที่ตรงกับเงื่อนไข</p>
                    </div>
                `;
                return;
            }

            elements.browseItemsGrid.innerHTML = items.map(createItemCardHTML).join('');
            setupCardClickListeners();
        } catch (err) {
            elements.browseItemsGrid.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}</div>`;
        }
    }

    function setupCardClickListeners() {
        document.querySelectorAll('.item-card').forEach(card => {
            const itemId = card.dataset.id;
            
            // Entire card click (or button click)
            card.addEventListener('click', (e) => {
                showItemDetails(itemId);
            });
        });
    }

    // Category Grid Item Clicks on Home
    elements.categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const category = item.dataset.category;
            currentCategoryFilter = category;
            
            // Set active class in sidebar filters
            elements.filterBtns.forEach(btn => {
                if (btn.dataset.category === category) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            switchView('browse');
        });
    });

    // Sidebar Category Filter Clicks
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentCategoryFilter = btn.dataset.category;
            applyBrowseFilters();
        });
    });

    // Search logic
    elements.browseSearchBtn.addEventListener('click', () => {
        currentSearchQuery = elements.browseSearchInput.value.trim();
        applyBrowseFilters();
    });

    elements.browseSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentSearchQuery = elements.browseSearchInput.value.trim();
            applyBrowseFilters();
        }
    });


    // --- ITEM DETAIL VIEW LOGIC ---

    async function showItemDetails(itemId) {
        elements.detailContent.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> กำลังโหลดรายละเอียด...</div>';
        switchView('detail');

        try {
            const item = await API.getItem(itemId);
            const statusText = item.status === 'available' ? 'พร้อมส่งต่อ' : (item.status === 'requested' ? 'มีผู้ขอรับแล้ว' : 'บริจาคแล้ว');
            const statusClass = `status-${item.status}`;
            const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1544027983-15c82c6569d9?w=800&auto=format&fit=crop&q=80';
            
            const isOwner = state.currentUser && state.currentUser.id === item.donor_id;

            let actionPanelHTML = '';
            
            if (isOwner) {
                // Owner panel to edit status or delete listing
                actionPanelHTML = `
                    <div class="donor-management-panel">
                        <h4><i class="fa-solid fa-sliders"></i> แผงจัดการสำหรับผู้บริจาค (คุณเป็นเจ้าของรายการนี้)</h4>
                        <div class="donor-status-actions">
                            <button class="btn btn-outline btn-sm btn-status-change ${item.status === 'available' ? 'active' : ''}" data-status="available">พร้อมบริจาค</button>
                            <button class="btn btn-outline btn-sm btn-status-change ${item.status === 'requested' ? 'active' : ''}" data-status="requested">จองไว้</button>
                            <button class="btn btn-outline btn-sm btn-status-change ${item.status === 'donated' ? 'active' : ''}" data-status="donated">บริจาคสำเร็จแล้ว</button>
                            <button class="btn btn-outline-danger btn-sm ml-auto" id="btn-delete-item"><i class="fa-solid fa-trash-can"></i> ลบประกาศ</button>
                        </div>
                    </div>
                `;
            } else {
                // Guest contact action
                actionPanelHTML = `
                    <div class="detail-actions">
                        <button class="btn btn-lg btn-primary btn-block" id="btn-contact-donor">
                            <i class="fa-solid fa-comments"></i> ทักแชทพูดคุยกับผู้บริจาค
                        </button>
                    </div>
                `;
            }

            elements.detailContent.innerHTML = `
                <div class="detail-gallery">
                    <div class="detail-img-box">
                        <img src="${imgUrl}" alt="${item.title}">
                    </div>
                </div>
                <div class="detail-info">
                    <div class="detail-header">
                        <div class="detail-meta">
                            <span class="detail-category">${item.category}</span>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <h2 class="detail-title">${item.title}</h2>
                    </div>

                    <div class="detail-desc-box">
                        <h4 class="detail-section-title">รายละเอียดสิ่งของ</h4>
                        <p class="detail-desc">${item.description}</p>
                    </div>

                    <div class="detail-donor-card">
                        <div class="donor-card-profile">
                            <div class="donor-card-avatar"><i class="fa-solid fa-user"></i></div>
                            <div>
                                <div class="donor-card-name">${item.donor_name}</div>
                                <div class="donor-card-tag">ผู้บริจาค</div>
                            </div>
                        </div>
                    </div>

                    ${actionPanelHTML}
                </div>
            `;

            // Back button event listener
            elements.btnDetailBack.onclick = () => {
                switchView('browse');
            };

            // Setup Details View Event Listeners
            if (isOwner) {
                // Status change buttons
                document.querySelectorAll('.btn-status-change').forEach(btn => {
                    btn.onclick = async () => {
                        const newStatus = btn.dataset.status;
                        try {
                            await API.updateItemStatus(item.id, newStatus);
                            showItemDetails(item.id); // Reload
                        } catch (err) {
                            alert(err.message);
                        }
                    };
                });

                // Delete button
                const btnDelete = document.getElementById('btn-delete-item');
                if (btnDelete) {
                    btnDelete.onclick = async () => {
                        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบประกาศสิ่งของบริจาคนี้?')) {
                            try {
                                await API.deleteItem(item.id);
                                switchView('browse');
                            } catch (err) {
                                alert(err.message);
                            }
                        }
                    };
                }
            } else {
                // Contact donor button
                const btnContact = document.getElementById('btn-contact-donor');
                if (btnContact) {
                    btnContact.onclick = () => {
                        // Open Chat View and select/create contact with item owner
                        startChatWithUser(item.donor_id, item.donor_name, item.donor_email);
                    };
                }
            }

        } catch (err) {
            elements.detailContent.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลดรายละเอียด: ${err.message}</div>`;
        }
    }


    // --- DONATE FORM / REGISTER ITEM LOGIC ---

    // File Input Drag & Drop / Preview
    elements.imageUploadArea.addEventListener('click', () => {
        elements.donateImage.click();
    });

    elements.donateImage.addEventListener('change', () => {
        handleFileSelect(elements.donateImage.files[0]);
    });

    function handleFileSelect(file) {
        if (!file) return;
        
        if (file.size > 15 * 1024 * 1024) {
            alert('ขนาดรูปภาพเกิน 15MB กรุณาเลือกไฟล์ที่ขนาดเล็กลง');
            elements.donateImage.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            elements.imagePreview.src = e.target.result;
            elements.imageUploadArea.style.display = 'none';
            elements.imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    elements.btnRemovePreview.onclick = () => {
        elements.donateImage.value = '';
        elements.imagePreview.src = '#';
        elements.imagePreviewContainer.style.display = 'none';
        elements.imageUploadArea.style.display = 'block';
    };

    // Donate Form Submission
    elements.formDonate.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.donateError.style.display = 'none';
        elements.donateSuccess.style.display = 'none';
        elements.formDonate.classList.add('loading');
        
        const title = elements.donateTitle.value.trim();
        const category = elements.donateCategory.value;
        const description = elements.donateDescription.value.trim();
        const file = elements.donateImage.files[0];

        if (!title || !category || !description || !file) {
            elements.donateError.textContent = 'กรุณากรอกข้อมูลและอัปโหลดรูปภาพให้ครบถ้วน';
            elements.donateError.style.display = 'flex';
            elements.formDonate.classList.remove('loading');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('description', description);
        formData.append('image', file);

        try {
            const data = await API.createItem(formData);
            elements.donateSuccess.textContent = 'ลงทะเบียนของบริจาคสำเร็จ กำลังนำคุณไปยังหน้ารายการสินค้า...';
            elements.donateSuccess.style.display = 'flex';
            
            // Clear form fields
            elements.donateTitle.value = '';
            elements.donateCategory.value = '';
            elements.donateDescription.value = '';
            elements.btnRemovePreview.click();

            setTimeout(() => {
                elements.donateSuccess.style.display = 'none';
                showItemDetails(data.item_id);
            }, 2000);
            
        } catch (err) {
            elements.donateError.textContent = err.message;
            elements.donateError.style.display = 'flex';
        } finally {
            elements.formDonate.classList.remove('loading');
        }
    });


    // --- CHAT LOGIC (Fastwork-like private chat) ---

    function startChatWithUser(receiverId, name, email) {
        if (!state.currentUser) {
            state.pendingChatTarget = {
                id: parseInt(receiverId),
                name: name,
                email: email
            };
            showAuthCard('login');
            switchView('auth');
            return;
        }

        // Setup active chat recipient state
        state.activeChatContact = {
            id: parseInt(receiverId),
            name: name,
            email: email
        };

        // Switch to Chat View and trigger panel loads
        switchView('chat');
        showActiveChatScreen();
    }

    async function loadChatContacts() {
        try {
            const contacts = await API.getChatContacts();
            
            // Calculate total unread count
            const totalUnread = contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0);
            if (totalUnread > 0) {
                elements.chatUnreadBadge.textContent = totalUnread;
                elements.chatUnreadBadge.style.display = 'inline-block';
            } else {
                elements.chatUnreadBadge.style.display = 'none';
            }

            if (contacts.length === 0 && !state.activeChatContact) {
                elements.chatContactsList.innerHTML = '<li class="empty-contacts">ไม่มีประวัติการพูดคุยในขณะนี้</li>';
                return;
            }

            // Create contacts list HTML
            let listHTML = '';
            
            // If we have an active chat contact that is not in the history yet, prepend it
            if (state.activeChatContact && !contacts.some(c => c.id === state.activeChatContact.id)) {
                listHTML += createContactItemHTML(state.activeChatContact, true);
            }

            listHTML += contacts.map(c => {
                const isActive = state.activeChatContact && state.activeChatContact.id === c.id;
                return createContactItemHTML(c, isActive);
            }).join('');

            elements.chatContactsList.innerHTML = listHTML;
            setupContactItemListeners();

        } catch (err) {
            console.error('Error loading chat contacts:', err);
        }
    }

    function createContactItemHTML(c, isActive) {
        const activeClass = isActive ? 'active' : '';
        const unreadHTML = c.unread_count > 0 ? `<span class="unread-badge">${c.unread_count}</span>` : '';
        const lastMsg = c.last_message || 'เริ่มการสนทนาใหม่...';
        
        let timeStr = '';
        if (c.last_message_time) {
            const msgDate = new Date(c.last_message_time);
            timeStr = msgDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        }

        return `
            <li class="contact-item ${activeClass}" data-id="${c.id}" data-name="${c.name}" data-email="${c.email}">
                <div class="contact-avatar"><i class="fa-solid fa-user"></i></div>
                <div class="contact-details">
                    <div class="contact-details-header">
                        <span class="contact-name">${c.name}</span>
                        <span class="contact-time">${timeStr}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="contact-msg-preview">${lastMsg}</span>
                        ${unreadHTML}
                    </div>
                </div>
            </li>
        `;
    }

    function setupContactItemListeners() {
        document.querySelectorAll('.contact-item').forEach(item => {
            item.onclick = () => {
                const contact = {
                    id: parseInt(item.dataset.id),
                    name: item.dataset.name,
                    email: item.dataset.email
                };
                
                // Highlight contact
                document.querySelectorAll('.contact-item').forEach(c => c.classList.remove('active'));
                item.classList.add('active');
                
                state.activeChatContact = contact;
                showActiveChatScreen();
            };
        });
    }

    function showActiveChatScreen() {
        if (!state.activeChatContact) {
            elements.chatWelcomeScreen.style.display = 'flex';
            elements.chatActiveScreen.style.display = 'none';
            return;
        }

        elements.chatWelcomeScreen.style.display = 'none';
        elements.chatActiveScreen.style.display = 'flex';

        elements.chatActiveName.textContent = state.activeChatContact.name;
        elements.chatActiveEmail.textContent = state.activeChatContact.email;

        // Force immediate message load and start polling
        loadChatMessages();
        startChatPolling();
    }

    async function loadChatMessages() {
        if (!state.activeChatContact) return;

        try {
            const messages = await API.getChatMessages(state.activeChatContact.id);
            
            // Track if list size changed to handle auto scroll
            const messageCountBefore = elements.chatMessagesContainer.children.length;

            if (messages.length === 0) {
                elements.chatMessagesContainer.innerHTML = `
                    <div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 0.85rem;">
                        ไม่มีประวัติข้อความ เริ่มต้นส่งข้อความเพื่อแบ่งปันสิ่งของกันเลย!
                    </div>
                `;
                return;
            }

            elements.chatMessagesContainer.innerHTML = messages.map(msg => {
                const isOutgoing = msg.sender_id === state.currentUser.id;
                const bubbleClass = isOutgoing ? 'outgoing' : 'incoming';
                const date = new Date(msg.created_at);
                const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

                return `
                    <div class="message-bubble ${bubbleClass}">
                        <div class="message-content">${escapeHTML(msg.message)}</div>
                        <span class="message-time">${timeStr}</span>
                    </div>
                `;
            }).join('');

            // Scroll to bottom if new messages arrived
            if (elements.chatMessagesContainer.children.length > messageCountBefore) {
                elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
            }

        } catch (err) {
            console.error('Error loading chat messages:', err);
        }
    }

    // Chat Message Form Send
    elements.formChatSend.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const messageText = elements.chatMessageInput.value.trim();
        if (!messageText || !state.activeChatContact) return;

        elements.chatMessageInput.value = '';

        try {
            // Optimistically insert outgoing message in bubble view for responsiveness
            const optDiv = document.createElement('div');
            optDiv.className = 'message-bubble outgoing';
            optDiv.innerHTML = `
                <div class="message-content">${escapeHTML(messageText)}</div>
                <span class="message-time">กำลังส่ง...</span>
            `;
            elements.chatMessagesContainer.appendChild(optDiv);
            elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;

            await API.sendMessage(state.activeChatContact.id, messageText);
            
            // Reload immediately
            loadChatMessages();
            loadChatContacts();

        } catch (err) {
            alert('ล้มเหลวในการส่งข้อความ: ' + err.message);
        }
    });

    // Chat Polling routines
    function startChatPolling() {
        stopChatPolling();
        state.chatPollInterval = setInterval(loadChatMessages, 3000);
    }

    function stopChatPolling() {
        if (state.chatPollInterval) {
            clearInterval(state.chatPollInterval);
            state.chatPollInterval = null;
        }
    }

    function startContactsPolling() {
        if (state.contactsPollInterval) return;
        loadChatContacts();
        state.contactsPollInterval = setInterval(loadChatContacts, 10000);
    }

    function stopContactsPolling() {
        if (state.contactsPollInterval) {
            clearInterval(state.contactsPollInterval);
            state.contactsPollInterval = null;
        }
    }


    // --- HELPERS ---

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // --- INITIALIZE APPLICATION ---
    
    async function init() {
        await checkAuth();
        switchView('home');
    }

    init();
});
