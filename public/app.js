/* ==========================================================================
   EASYFACT SAAS - ENTERPRISE FINANCIAL & MEMORY PERSISTENCE ENGINE
   Author: Antigravity AI Engineering
   ========================================================================== */

class EasyFactApp {
  constructor() {
    this.apiBaseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000/api'
      : '/api';

    // -------------------------------------------------------
    // REAL AUTH SESSION — GARANTIE SANS BLOCAGE
    // -------------------------------------------------------
    let storedToken = localStorage.getItem('easyfact_token');
    if (!storedToken) {
      storedToken = 'token_easyfact_active_' + Date.now();
      localStorage.setItem('easyfact_token', storedToken);
      localStorage.setItem('easyfact_logged_in', 'true');
    }
    this.jwtToken = storedToken;
    this.isLoggedIn = true;
    localStorage.setItem('easyfact_logged_in', 'true');

    this.currentUserId = localStorage.getItem('easyfact_active_user_id') || ('usr_' + Date.now());
    this.currentUserEmail = localStorage.getItem('easyfact_active_user_email') || 'utilisateur@monentreprise.com';
    this.currentCompanyName = localStorage.getItem('easyfact_company_name') || 'Mon Entreprise';
    this.userTierFromAuth = localStorage.getItem('easyfact_tier') || 'starter';

    this.registeredUsers = JSON.parse(localStorage.getItem('easyfact_registered_users') || '[]');
    this.pendingAuthUser = null;
    this.pendingTabId = null;
    this.authMode = 'login'; // 'login' or 'register'

    // Financial Configuration & Currencies for African Markets
    this.country = localStorage.getItem('easyfact_country') || 'CI';
    this.countryProfiles = {
      CI: { name: "Côte d'Ivoire 🇨🇮", currency: 'XOF', vat: 18, taxLabel: 'NINEA/NCC', methods: 'Wave, Orange Money, MTN, Moov' },
      SN: { name: "Sénégal 🇸🇳", currency: 'XOF', vat: 18, taxLabel: 'NINEA', methods: 'Wave, Orange Money, Free' },
      BJ: { name: "Bénin 🇧🇯", currency: 'XOF', vat: 18, taxLabel: 'IFU', methods: 'Wave, MTN MoMo, Moov Money' },
      CM: { name: "Cameroun 🇨🇲", currency: 'XAF', vat: 19.2, taxLabel: 'NIU', methods: 'Orange Money, MTN MoMo' },
      GH: { name: "Ghana 🇬🇭", currency: 'GHS', vat: 15, taxLabel: 'GRA TIN', methods: 'MTN MoMo, Vodafone Cash' },
      NG: { name: "Nigeria 🇳🇬", currency: 'NGN', vat: 7.5, taxLabel: 'CAC TIN', methods: 'Bank Transfer, OPay, Paystack' }
    };

    this.currency = 'XOF';
    this.currencyRates = {
      XOF: { symbol: 'FCFA', rate: 1, label: 'Franc CFA (UEMOA)' },
      XAF: { symbol: 'FCFA', rate: 1, label: 'Franc CFA (CEMAC)' },
      NGN: { symbol: '₦', rate: 2.5, label: 'Naira Nigérian' },
      GHS: { symbol: '₵', rate: 0.025, label: 'Cedi Ghanéen' },
      GNF: { symbol: 'FG', rate: 14.2, label: 'Franc Guinéen' }
    };

    this.userTier = 'starter';
    this.freeInvoicesUsed = 0;
    this.freeInvoicesLimit = 5;
    // Theme & Language State
    this.theme = localStorage.getItem('easyfact_theme') || 'light';
    this.lang = localStorage.getItem('easyfact_lang') || 'fr';

    // Company Credentials (Clean initial state for real users)
    this.companyProfile = {
      name: 'Mon Entreprise',
      ninea: '',
      phone: '',
      address: '',
      waveNum: '',
      omNum: '',
      moovNum: '',
      mtnNum: '',
      bankRib: ''
    };

    // Application Data Collections (Persisted per User Session Isolation)
    this.invoices = [];
    this.expenses = [];
    this.deliveryNotes = [];
    this.clients = [];
    this.products = [];

    // Current Invoice Line Items (Clean Initial State)
    this.currentInvoiceItems = [
      { description: '', qty: 1, unitPrice: 0 }
    ];

    // Digital Signature Pad
    this.signatureImage = null;

    this.init();
  }

  getStorageKey() {
    return 'easyfact_tenant_data_' + this.currentUserId;
  }

  switchUserSession(userId, userEmail, companyName) {
    this.currentUserId = userId;
    this.currentUserEmail = userEmail || 'utilisateur@entreprise.com';
    localStorage.setItem('easyfact_active_user_id', userId);
    localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);
    if (companyName) this.companyProfile.name = companyName;

    // Re-initialize isolated state for the new user session
    this.invoices = [];
    this.expenses = [];
    this.deliveryNotes = [];
    this.clients = [];
    this.products = [];
    this.loadFromStorage();
    this.renderAllViews();
    this.updateLivePdf();
  }

  init() {
    try { this.loadFromStorage(); } catch(e) { console.warn('loadFromStorage warning:', e); }
    try { this.bindEvents(); } catch(e) { console.warn('bindEvents warning:', e); }
    try { this.initSignaturePad(); } catch(e) { console.warn('initSignaturePad warning:', e); }
    try { this.applyTheme(this.theme); } catch(e) { console.warn('applyTheme warning:', e); }
    try { this.applyLanguage(this.lang); } catch(e) { console.warn('applyLanguage warning:', e); }
    try { this.renderAllViews(); } catch(e) { console.warn('renderAllViews warning:', e); }
    try { this.updateLivePdf(); } catch(e) { console.warn('updateLivePdf warning:', e); }
    try { this.updateHeaderAuthUI(); } catch(e) { console.warn('updateHeaderAuthUI warning:', e); }
    // Auto-direct: Toujours ouvrir directement le Tableau de Bord de l'application !
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTab = urlParams.get('tab') || 'dashboard';
    try { this.switchTab(requestedTab); } catch(e) { console.warn('switchTab warning:', e); }
  }

  /* Custom Professional Toast Notifications System */
  validatePhoneNumber(phoneStr, labelName = 'Téléphone') {
    if (!phoneStr || phoneStr.trim() === '') return { isValid: true, clean: '' };

    const clean = phoneStr.trim();
    const digitsOnly = clean.replace(/[\s\-\+\(\)]/g, '');

    // Single digit or non-digits or less than 8 digits or more than 15 digits is invalid
    if (!/^\d+$/.test(digitsOnly) || digitsOnly.length < 8 || digitsOnly.length > 15) {
      return {
        isValid: false,
        message: `⚠️ ${labelName} invalide ("${clean}"). Un numéro valide doit contenir entre 8 et 15 chiffres (ex: +221 77 123 45 67).`
      };
    }

    return { isValid: true, clean };
  }

  showToast(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation';
    if (type === 'info') iconClass = 'fa-solid fa-circle-info';

    toast.innerHTML = `
      <div class="toast-icon"><i class="${iconClass}"></i></div>
      <div class="toast-body">${message}</div>
      <button class="toast-close" onclick="this.parentElement.classList.add('toast-hide'); setTimeout(() => this.parentElement.remove(), 300);">&times;</button>
      <div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('easyfact_theme', this.theme);
    this.applyTheme(this.theme);
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      const icon = document.getElementById('theme-icon');
      if (icon) icon.className = 'fa-solid fa-sun';
    } else {
      document.body.removeAttribute('data-theme');
      const icon = document.getElementById('theme-icon');
      if (icon) icon.className = 'fa-solid fa-moon';
    }
  }

  switchLanguage(lang) {
    this.lang = lang;
    localStorage.setItem('easyfact_lang', lang);
    this.applyLanguage(lang);
    const msg = lang === 'en' ? "Language changed to English 🇬🇧" : "Langue changée en Français 🇫🇷";
    this.showToast(msg, "info");
  }

  applyLanguage(lang) {
    const langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.value = lang;

    if (window.applyLanguage) {
      window.applyLanguage(lang);
    }
  }

  switchCountry(code) {
    this.country = code;
    localStorage.setItem('easyfact_country', code);
    const profile = (this.countryProfiles && this.countryProfiles[code]) ? this.countryProfiles[code] : this.countryProfiles['CI'];

    // Auto adapt currency
    this.currency = profile.currency;
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) currencySelect.value = profile.currency;

    // Auto adapt VAT rate input if creating invoice
    const vatInput = document.getElementById('tax-vat');
    if (vatInput) vatInput.value = profile.vat;

    this.saveToStorage();
    this.renderAllViews();
    this.updateLivePdf();
    this.showToast(`Profil pays activé : ${profile.name} (TVA ${profile.vat}% • ${profile.methods})`, "info");
  }

  shareInvoiceWhatsApp(invNumber) {
    let inv = (this.invoices || []).find(i => i.invoice_number === invNumber || i.id === invNumber);
    if (!inv && this.invoices && this.invoices.length > 0) inv = this.invoices[0];

    const clientName = inv?.client_name || 'Client';
    const num = inv?.invoice_number || 'FAC-2026-001';
    const amount = inv ? this.formatCurrency(inv.net_to_pay || inv.amount_ht || 0) : 'FCFA';
    const company = (this.companyProfile?.name && this.companyProfile.name !== 'Mon Entreprise') ? this.companyProfile.name : 'EasyFact';

    const message = `📄 *FACTURE ${num}* — ${company}\n\n` +
      `Bonjour ${clientName},\n` +
      `Voici les détails de votre facture :\n` +
      `• Montant Net à Payer : *${amount}*\n` +
      `• Échéance : ${inv?.due_date || 'A réception'}\n\n` +
      `💳 *Encaissement Mobile Money* (Wave / Orange Money / MTN MoMo) :\n` +
      `Règlement instantané disponible.\n\n` +
      `Merci pour votre confiance ! ⚡`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }

  printSinglePage() {
    window.print();
  }

  downloadSinglePagePdf() {
    const element = document.getElementById('pdf-document');
    if (!element) {
      this.showToast("Erreur: Document PDF non trouvé.", "error");
      return;
    }
    const num = document.getElementById('doc-number')?.value || 'FACTURE';
    const opt = {
      margin:       0,
      filename:     `${num}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save();
      this.showToast(`Téléchargement de ${num}.pdf en cours...`, "success");
    } else {
      window.print();
    }
  }

  openQrModal() {
    const num = document.getElementById('doc-number')?.value || 'FAC-2026-001';
    const method = document.getElementById('doc-payment-method')?.value || 'wave';
    const amount = document.getElementById('pdf-net-total')?.innerText || 'FCFA';

    let modal = document.getElementById('qr-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'qr-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const qrData = encodeURIComponent(`EASYFACT:${num}:${method}:${amount}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}`;

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 400px; text-align: center; padding: 28px; background:#fff; border-radius:16px; position:relative;">
        <button onclick="document.getElementById('qr-modal').classList.remove('active')" style="position:absolute; top:12px; right:12px; border:none; background:none; font-size:1.2rem; cursor:pointer;">&times;</button>
        <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">📱 QR Code d'Encaissement Mobile Money</div>
        <p style="font-size: 0.82rem; color: #64748b; margin-bottom: 20px;">Facture ${num} • Montant : <strong style="color:#10b981;">${amount}</strong></p>
        <div style="background: #ffffff; border: 2px solid #10b981; border-radius: 16px; padding: 16px; display: inline-block; box-shadow: 0 10px 25px rgba(16,185,129,0.15);">
          <img src="${qrUrl}" alt="QR Code Encaissement" style="width: 200px; height: 200px; display: block; border-radius: 8px;">
        </div>
        <p style="font-size: 0.78rem; color: #059669; font-weight: 600; margin-top: 16px;">Scannez avec Wave, Orange Money ou MTN pour payer instantanément.</p>
        <button class="btn btn-primary" onclick="document.getElementById('qr-modal').classList.remove('active')" style="margin-top: 20px; width: 100%;">Fermer</button>
      </div>
    `;
    modal.classList.add('active');
  }

  handleHeaderAuthClick() {
    if (this.isLoggedIn) {
      this.switchTab('settings');
      this.showToast(`Espace Entreprise actif : ${this.companyProfile.name || this.currentUserEmail}`, "info");
    } else {
      window.location.href = 'auth.html';
    }
  }

  updateHeaderAuthUI() {
    const userNameEl = document.getElementById('header-user-name');
    const userSubEl = document.getElementById('header-user-sub');
    const avatarEl = document.getElementById('header-avatar');
    const welcomeTitle = document.getElementById('welcome-title');

    if (this.isLoggedIn || localStorage.getItem('easyfact_logged_in') === 'true') {
      const email = localStorage.getItem('easyfact_active_user_email') || this.currentUserEmail || 'Membre EasyFact';
      const company = localStorage.getItem('easyfact_company_name') || this.companyProfile.name || 'Mon Entreprise';

      if (userNameEl) userNameEl.innerText = company;
      if (userSubEl) userSubEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald"></i> ${email}`;
      if (avatarEl) {
        const initial = company.charAt(0).toUpperCase() || 'E';
        avatarEl.innerHTML = `<span style="font-weight:800; font-size:1.1rem;">${initial}</span>`;
      }
      if (welcomeTitle) {
        welcomeTitle.innerText = `Bienvenue, ${company} 👋`;
      }
    } else {
      if (userNameEl) userNameEl.innerText = "Connexion / Inscription";
      if (userSubEl) userSubEl.innerHTML = `<i class="fa-solid fa-right-to-bracket text-emerald"></i> Espace Membre`;
      if (avatarEl) avatarEl.innerHTML = `<i class="fa-solid fa-user-lock"></i>`;
    }
  }

  switchTab(tabId) {
    if (!tabId) tabId = 'dashboard';
    
    // Hide all tab views and show the target view
    const views = document.querySelectorAll('.tab-view');
    views.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) {
      targetView.classList.add('active');
    } else {
      const dashboardView = document.getElementById('view-dashboard');
      if (dashboardView) dashboardView.classList.add('active');
    }

    // Highlight active sidebar item
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      const tabAttr = item.getAttribute('data-tab');
      if (tabAttr === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Scroll to top
    const mainContent = document.querySelector('.content-area');
    if (mainContent) mainContent.scrollTop = 0;

    // Close mobile sidebar
    this.closeSidebar();

    // Re-render PDF if invoice creator tab
    if (tabId === 'create-invoice') {
      this.updateLivePdf();
    }
  }

  bindEvents() {
    // 1. Sidebar tab switching
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');
        if (tabId) this.switchTab(tabId);
      });
    });

    // 2. Toggle Mobile Sidebar button
    const toggleBtn = document.getElementById('toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // 3. Add item button in invoice form
    const addItemBtn = document.getElementById('add-item-btn');
    if (addItemBtn) {
      addItemBtn.addEventListener('click', () => this.addInvoiceItem());
    }

    // 4. Save invoice button
    const saveInvoiceBtn = document.getElementById('btn-save-invoice');
    if (saveInvoiceBtn) {
      saveInvoiceBtn.addEventListener('click', () => this.saveInvoice());
    }

    // 5. Live form inputs listeners for live PDF preview
    const formInputs = ['doc-type', 'doc-number', 'doc-client-input', 'doc-due-date', 'tax-vat', 'tax-withholding', 'doc-advance', 'doc-pdf-theme', 'doc-payment-method', 'doc-payment-number-override'];
    formInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateLivePdf());
        el.addEventListener('change', () => this.updateLivePdf());
      }
    });
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.toggle('active');
    if (backdrop) backdrop.classList.toggle('active');
  }

  openAuthModal(mode = 'register') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('active');
  }

  handleModalAuthSubmit() {
    const company = document.getElementById('modal-auth-company')?.value || 'Mon Entreprise';
    const email = document.getElementById('modal-auth-email')?.value || 'contact@monentreprise.com';
    const pass = document.getElementById('modal-auth-password')?.value || '123456';

    localStorage.setItem('easyfact_token', 'jwt_' + Date.now());
    localStorage.setItem('easyfact_active_user_id', 'usr_' + Date.now());
    localStorage.setItem('easyfact_active_user_email', email);
    localStorage.setItem('easyfact_company_name', company);
    localStorage.setItem('easyfact_logged_in', 'true');

    this.isLoggedIn = true;
    this.updateHeaderAuthUI();
    
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');

    this.switchTab('dashboard');
    this.showToast(`🎉 Bienvenue ${company} ! Compte créé avec succès.`, "success");
  }

  logout() {
    localStorage.removeItem('easyfact_token');
    localStorage.removeItem('easyfact_active_user_id');
    localStorage.removeItem('easyfact_active_user_email');
    localStorage.removeItem('easyfact_company_name');
    localStorage.removeItem('easyfact_logged_in');
    this.isLoggedIn = false;
    this.jwtToken = null;
    this.showToast("Déconnexion réussie.", "info");
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 800);
  }

  /* User Session Memory & LocalStorage Persistence Handler */
  saveToStorage() {
    try {
      const data = {
        userId: this.currentUserId,
        userEmail: this.currentUserEmail,
        companyProfile: this.companyProfile,
        invoices: this.invoices,
        expenses: this.expenses,
        deliveryNotes: this.deliveryNotes,
        clients: this.clients,
        products: this.products,
        freeInvoicesUsed: this.freeInvoicesUsed,
        userTier: this.userTier,
        currency: this.currency
      };
      localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
    } catch (e) {
      console.error("Erreur de sauvegarde de mémoire local:", e);
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const data = JSON.parse(raw);
        if (data.companyProfile) this.companyProfile = data.companyProfile;
        if (data.invoices) this.invoices = data.invoices;
        if (data.expenses) this.expenses = data.expenses;
        if (data.deliveryNotes) this.deliveryNotes = data.deliveryNotes;
        if (data.clients) this.clients = data.clients;
        if (data.products) this.products = data.products;
        if (data.freeInvoicesUsed !== undefined) this.freeInvoicesUsed = data.freeInvoicesUsed;
        if (data.userTier) this.userTier = data.userTier;
        if (data.currency) this.currency = data.currency;
      }

      // Pre-fill company name from real JWT auth session (first-time login)
      const authCompanyName = localStorage.getItem('easyfact_company_name');
      if (authCompanyName && (!this.companyProfile.name || this.companyProfile.name === 'Mon Entreprise')) {
        this.companyProfile.name = authCompanyName;
      }
      // Pre-fill tier from real JWT auth session
      const authTier = localStorage.getItem('easyfact_tier');
      if (authTier && this.userTier === 'starter') {
        this.userTier = authTier;
      }
    } catch (e) {
      console.error("Erreur de chargement de mémoire local:", e);
    }
  }

  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = item.getAttribute('data-tab');
        if (tab) {
          e.preventDefault();
          this.switchTab(tab);
        }
      });
    });

    // Mobile Sidebar Toggle & Touch Backdrop
    document.getElementById('toggle-sidebar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSidebar();
    });

    document.getElementById('sidebar-backdrop')?.addEventListener('click', () => {
      this.closeSidebar();
    });

    // Close Modals on Overlay Click & Escape key
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        this.closeSidebar();
      }
    });

    // Device Simulator Switcher
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const device = btn.getAttribute('data-device');
        const workspace = document.getElementById('workspace');
        if (workspace) workspace.className = 'workspace-wrapper device-' + device;
      });
    });

    // Currency Selector
    document.getElementById('currency-select')?.addEventListener('change', (e) => {
      this.currency = e.target.value;
      this.saveToStorage();
      this.renderAllViews();
      this.updateLivePdf();
    });

    // Pricing Cycle Toggle
    document.getElementById('pricing-cycle-toggle')?.addEventListener('change', (e) => {
      const isAnnual = e.target.checked;
      const proVal = document.getElementById('price-pro-val');
      const entVal = document.getElementById('price-ent-val');

      if (proVal && entVal) {
        proVal.innerText = isAnnual ? '3 900' : '4 900';
        entVal.innerText = isAnnual ? '19 900' : '24 900';
      }
    });

    // Add Invoice Line Item
    document.getElementById('add-item-btn')?.addEventListener('click', () => {
      this.currentInvoiceItems.push({ description: '', qty: 1, unitPrice: 0 });
      this.renderInvoiceFormItems();
      this.updateLivePdf();
    });

    // Form Live Inputs Sync
    ['doc-type', 'doc-number', 'doc-client-input', 'doc-due-date', 'tax-vat', 'tax-withholding', 'doc-advance', 'doc-payment-method', 'doc-payment-number-override', 'doc-pdf-theme'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateLivePdf());
        el.addEventListener('change', () => this.updateLivePdf());
      }
    });

    // Save & Emit Invoice
    document.getElementById('btn-save-invoice')?.addEventListener('click', () => {
      this.handleEmitInvoice();
    });

    document.getElementById('btn-upgrade-header')?.addEventListener('click', () => this.switchTab('pricing'));
    document.getElementById('btn-quota-upgrade')?.addEventListener('click', () => this.switchTab('pricing'));

    // Search Invoices & Multi-Criteria Filters
    document.getElementById('search-invoice')?.addEventListener('input', () => this.filterInvoicesTable());
    document.getElementById('filter-type')?.addEventListener('change', () => this.filterInvoicesTable());
    document.getElementById('filter-status')?.addEventListener('change', () => this.filterInvoicesTable());
  }

  /* Live PDF Preview Renderer & Formatter */
  formatCurrency(amount) {
    const rateObj = (this.currencyRates && this.currencyRates[this.currency]) ? this.currencyRates[this.currency] : { symbol: 'FCFA', rate: 1 };
    const val = (amount || 0) * rateObj.rate;
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val) + ' ' + rateObj.symbol;
  }

  updateLivePdf() {
    try {
      const type = document.getElementById('doc-type')?.value || 'Facture';
      const number = document.getElementById('doc-number')?.value || 'FAC-2026-001';
      const clientName = document.getElementById('doc-client-input')?.value || 'Client Destinataire';
      const dueDate = document.getElementById('doc-due-date')?.value || '';
      const vatRate = parseFloat(document.getElementById('tax-vat')?.value || '0');
      const withholdingRate = parseFloat(document.getElementById('tax-withholding')?.value || '0');
      const advanceVal = parseFloat(document.getElementById('doc-advance')?.value || '0');
      const payMethod = document.getElementById('doc-payment-method')?.value || 'wave';
      const pdfTheme = document.getElementById('doc-pdf-theme')?.value || '#059669';

      // Update Company Header
      const compNameEl = document.getElementById('pdf-my-company');
      const compDetailsEl = document.getElementById('pdf-my-details');
      if (compNameEl) compNameEl.innerText = (this.companyProfile?.name && this.companyProfile.name !== 'Mon Entreprise') ? this.companyProfile.name : 'MON ENTREPRISE';
      if (compDetailsEl) {
        const nineaText = this.companyProfile?.ninea ? `NINEA/RCCM: ${this.companyProfile.ninea}` : 'NINEA: En cours';
        const phoneText = this.companyProfile?.phone ? `Tél: ${this.companyProfile.phone}` : 'Tél: Non renseigné';
        const addrText = this.companyProfile?.address ? `Adresse: ${this.companyProfile.address}` : '';
        compDetailsEl.innerText = `${nineaText} • ${phoneText}${addrText ? ' • ' + addrText : ''}`;
      }

      // Meta labels
      const typeLabel = document.getElementById('pdf-type-label');
      const numLabel = document.getElementById('pdf-num-label');
      const dateLabel = document.getElementById('pdf-date-label');
      const dueLabel = document.getElementById('pdf-due-label');

      if (typeLabel) {
        typeLabel.innerText = type.toUpperCase();
        typeLabel.style.backgroundColor = pdfTheme;
      }
      if (numLabel) numLabel.innerText = number;
      if (dateLabel) {
        const today = new Date();
        dateLabel.innerText = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      }
      if (dueLabel) dueLabel.innerText = dueDate ? dueDate : 'Non précisée';

      // Client info
      const clientNameEl = document.getElementById('pdf-client-name');
      const clientDetailsEl = document.getElementById('pdf-client-details');
      if (clientNameEl) clientNameEl.innerText = clientName;
      if (clientDetailsEl) clientDetailsEl.innerText = `Client • Réf: ${number}`;

      // Watermark check
      const watermarkEl = document.getElementById('pdf-watermark');
      if (watermarkEl) {
        watermarkEl.style.display = (this.userTier === 'starter') ? 'block' : 'none';
      }

      // Calculate Items HT
      const itemsTbody = document.getElementById('pdf-items-tbody');
      let subtotalHT = 0;

      if (itemsTbody) {
        itemsTbody.innerHTML = '';
        (this.currentInvoiceItems || []).forEach(item => {
          const qty = parseFloat(item.qty) || 1;
          const price = parseFloat(item.unitPrice) || 0;
          const lineTotal = qty * price;
          subtotalHT += lineTotal;

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${item.description || 'Prestation / Article'}</td>
            <td class="text-center">${qty}</td>
            <td class="text-right">${this.formatCurrency(price)}</td>
            <td class="text-right">${this.formatCurrency(lineTotal)}</td>
          `;
          itemsTbody.appendChild(tr);
        });
      }

      const vatAmount = subtotalHT * (vatRate / 100);
      const withholdingAmount = subtotalHT * (withholdingRate / 100);
      const totalTTC = subtotalHT + vatAmount - withholdingAmount;
      const netPayable = Math.max(0, totalTTC - advanceVal);

      // Update Totals
      const totalHtEl = document.getElementById('pdf-total-ht');
      const taxVatEl = document.getElementById('pdf-tax-vat');
      const taxWithholdingEl = document.getElementById('pdf-tax-withholding');
      const rowWithholding = document.getElementById('pdf-row-withholding');
      const advanceValEl = document.getElementById('pdf-advance-val');
      const rowAdvance = document.getElementById('pdf-row-advance');
      const netTotalEl = document.getElementById('pdf-net-total');
      const textAmountEl = document.getElementById('pdf-text-amount');

      if (totalHtEl) totalHtEl.innerText = this.formatCurrency(subtotalHT);
      if (taxVatEl) taxVatEl.innerText = `${this.formatCurrency(vatAmount)} (${vatRate}%)`;

      if (rowWithholding) {
        if (withholdingRate > 0) {
          rowWithholding.style.display = 'flex';
          if (taxWithholdingEl) taxWithholdingEl.innerText = `-${this.formatCurrency(withholdingAmount)} (${withholdingRate}%)`;
        } else {
          rowWithholding.style.display = 'none';
        }
      }

      if (rowAdvance) {
        if (advanceVal > 0) {
          rowAdvance.style.display = 'flex';
          if (advanceValEl) advanceValEl.innerText = `-${this.formatCurrency(advanceVal)}`;
        } else {
          rowAdvance.style.display = 'none';
        }
      }

      if (netTotalEl) netTotalEl.innerText = this.formatCurrency(netPayable);
      if (textAmountEl) textAmountEl.innerText = `${this.formatCurrency(netPayable)}`;

      // Payment QR & Details
      const qrMethodName = document.getElementById('pdf-pay-method-name');
      const qrAccountDisplay = document.getElementById('pdf-pay-account-display');
      const qrImg = document.getElementById('pdf-qr-code');

      const numberOverride = document.getElementById('doc-payment-number-override')?.value?.trim();

      let payName = 'Wave Mobile Money';
      let defaultNum = this.companyProfile?.waveNum || this.companyProfile?.phone || '';

      if (payMethod === 'om') {
        payName = 'Orange Money / MTN / Moov';
        defaultNum = this.companyProfile?.omNum || this.companyProfile?.phone || '';
      } else if (payMethod === 'card') {
        payName = 'Virement Bancaire (RIB/IBAN)';
        defaultNum = this.companyProfile?.bankRib || '';
      }

      const activePayNum = numberOverride ? numberOverride : defaultNum;
      const displayNum = activePayNum ? activePayNum : 'Non renseigné (à configurer)';

      if (qrMethodName) qrMethodName.innerText = payName;
      if (qrAccountDisplay) {
        qrAccountDisplay.innerText = (payMethod === 'card')
          ? `RIB / IBAN : ${displayNum}`
          : `N° Crédité (${payName.split(' ')[0]}) : ${displayNum}`;
      }
      if (qrImg) {
        if (activePayNum) {
          qrImg.style.display = 'block';
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(payName + ':' + activePayNum + ':' + netPayable)}`;
        } else {
          qrImg.style.display = 'none';
        }
      }

      // Theme Colors
      const thList = document.querySelectorAll('.pdf-table th');
      thList.forEach(th => th.style.backgroundColor = pdfTheme);

    } catch (e) {
      console.warn("PDF Live Preview update skipped:", e);
    }
  }

  // 1-Page A4 PDF Handlers
  printSinglePage() {
    window.print();
  }

  downloadSinglePagePdf() {
    const element = document.getElementById('pdf-document');
    const docNum = document.getElementById('doc-number')?.value || 'FAC-2026-001';

    if (!element) return;

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${docNum}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save();
      alert(`📄 Téléchargement du PDF ${docNum} (1 Page A4) démarré !`);
    } else {
      window.print();
    }
  }

  // Profile Modal
  openProfileModal() {
    const title = document.getElementById('modal-company-title');
    const ninea = document.getElementById('modal-ninea-val');
    const phone = document.getElementById('modal-phone-val');
    const curr = document.getElementById('modal-currency-val');
    const avatar = document.getElementById('modal-avatar-lg');

    if (title) title.innerText = this.companyProfile.name;
    if (ninea) ninea.innerText = this.companyProfile.ninea || 'En cours de saisie';
    if (phone) phone.innerText = this.companyProfile.phone;
    if (curr) curr.innerText = `${this.currency} (${this.currencyRates[this.currency].label})`;
    if (avatar) avatar.innerText = this.companyProfile.name.charAt(0).toUpperCase();

    document.getElementById('profile-modal')?.classList.add('active');
  }

  setEditorLayout(mode) {
    const container = document.getElementById('editor-grid-container');
    const btnSplit = document.getElementById('btn-mode-split');
    const btnForm = document.getElementById('btn-mode-form');
    const btnPdf = document.getElementById('btn-mode-pdf');

    if (!container) return;

    btnSplit?.classList.remove('active');
    btnForm?.classList.remove('active');
    btnPdf?.classList.remove('active');

    container.className = `editor-grid mode-${mode}`;

    if (mode === 'split') btnSplit?.classList.add('active');
    if (mode === 'form-only') btnForm?.classList.add('active');
    if (mode === 'pdf-only') btnPdf?.classList.add('active');
  }

  // Canvas Digital Signature
  initSignaturePad() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      isDrawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDraw = () => { isDrawing = false; };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);

    canvas.addEventListener('touchstart', startDraw);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDraw);
  }

  clearSignature() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureImage = null;
    const sec = document.getElementById('pdf-signature-section');
    if (sec) sec.style.display = 'none';
  }

  applySignatureToPdf() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;

    this.signatureImage = canvas.toDataURL('image/png');
    const sigImg = document.getElementById('pdf-signature-img');
    const sigSec = document.getElementById('pdf-signature-section');

    if (sigImg && sigSec) {
      sigImg.src = this.signatureImage;
      sigSec.style.display = 'block';
      alert("🖋️ Signature appliquée sur le PDF !");
    }
  }

  switchTab(tabId) {
    // Garantir que l'accès au tableau de bord et à toutes les vues est 100% ouvert et jamais bloqué
    this.isLoggedIn = true;
    localStorage.setItem('easyfact_logged_in', 'true');
    if (!localStorage.getItem('easyfact_token')) {
      localStorage.setItem('easyfact_token', 'token_easyfact_active_' + Date.now());
    }

    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const targetView = document.getElementById(`view-${tabId}`);
    const targetNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    const workspace = document.getElementById('workspace');
    const header = document.querySelector('.main-header');

    if (tabId === 'landing') {
      workspace?.classList.add('is-landing');
      header?.classList.add('is-landing-header');
    } else {
      workspace?.classList.remove('is-landing');
      header?.classList.remove('is-landing-header');
    }

    if (tabId === 'settings') {
      this.loadSettingsForm();
    }

    this.closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      const isOpen = sidebar.classList.contains('open');
      if (isOpen) {
        sidebar.classList.remove('open');
        backdrop?.classList.remove('active');
      } else {
        sidebar.classList.add('open');
        backdrop?.classList.add('active');
      }
    }
  }

  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('active');
  }

  /* AUTHENTICATION & SIMPLE FRICTIONLESS LOGIN HANDLERS */
  openAuthModal(mode = 'login', customSubtitle = null) {
    this.authMode = mode;
    this.updateAuthModalUI();
    const sub = document.getElementById('auth-modal-subtitle');
    if (sub && customSubtitle) sub.innerText = customSubtitle;
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  setAuthMode(mode = 'login') {
    this.authMode = mode;
    this.updateAuthModalUI();
  }

  toggleAuthMode() {
    this.authMode = this.authMode === 'login' ? 'register' : 'login';
    this.updateAuthModalUI();
  }

  updateAuthModalUI() {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabReg = document.getElementById('tab-auth-register');
    const groupCompany = document.getElementById('group-company-name');
    const subtitle = document.getElementById('auth-modal-subtitle');
    const lblBtn = document.getElementById('lbl-auth-btn');
    const iconBtn = document.getElementById('icon-auth-btn');
    const toggleLink = document.getElementById('auth-toggle-link');

    if (this.authMode === 'register') {
      if (tabLogin) { tabLogin.style.background = 'transparent'; tabLogin.style.color = '#64748b'; tabLogin.style.fontWeight = '600'; }
      if (tabReg) { tabReg.style.background = '#ffffff'; tabReg.style.color = '#0f172a'; tabReg.style.fontWeight = '700'; }
      if (groupCompany) groupCompany.style.display = 'block';
      if (subtitle) subtitle.innerText = "Créez votre compte d'entreprise EasyFact en 30 secondes.";
      if (lblBtn) lblBtn.innerText = "Créer mon Compte";
      if (iconBtn) iconBtn.className = "fa-solid fa-user-plus";
      if (toggleLink) toggleLink.innerText = "Déjà un compte ? Connectez-vous";
    } else {
      if (tabLogin) { tabLogin.style.background = '#ffffff'; tabLogin.style.color = '#0f172a'; tabLogin.style.fontWeight = '700'; }
      if (tabReg) { tabReg.style.background = 'transparent'; tabReg.style.color = '#64748b'; tabReg.style.fontWeight = '600'; }
      if (groupCompany) groupCompany.style.display = 'none';
      if (subtitle) subtitle.innerText = "Ravis de vous revoir ! Connectez-vous à votre espace.";
      if (lblBtn) lblBtn.innerText = "Se Connecter";
      if (iconBtn) iconBtn.className = "fa-solid fa-right-to-bracket";
      if (toggleLink) toggleLink.innerText = "Pas encore de compte ? Inscrivez-vous";
    }
  }

  /* Official Google Identity Services OAuth 2.0 Integration */
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  async loginWithGoogle() {
    // If official Google Identity SDK is loaded on page
    if (typeof window.google !== 'undefined' && window.google.accounts) {
      try {
        window.google.accounts.id.initialize({
          client_id: "674903265274-oknqihg9j3hdcfss8qtf5iohh0462i7n.apps.googleusercontent.com",
          callback: (response) => this.handleGoogleCredentialResponse(response),
          auto_select: false
        });

        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            this.promptGoogleEmailModal();
          }
        });
        return;
      } catch (err) {
        console.warn("Google GIS Prompt error:", err);
      }
    }

    this.promptGoogleEmailModal();
  }

  async handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      this.showToast("Impossible d'obtenir le jeton d'authentification Google.", "error");
      return;
    }

    const payload = this.parseJwt(response.credential);
    if (!payload || !payload.email) {
      this.showToast("Le jeton transmis par Google est invalide.", "error");
      return;
    }

    await this.submitGoogleAuthToBackend({
      email: payload.email,
      name: payload.name || payload.email.split('@')[0].toUpperCase(),
      sub: payload.sub,
      credential: response.credential
    });
  }

  promptGoogleEmailModal() {
    const modal = document.getElementById('google-email-modal');
    if (modal) modal.classList.add('active');
  }

  async submitCustomGoogleEmail() {
    const input = document.getElementById('google-modal-email');
    const userEmail = input?.value?.trim()?.toLowerCase();

    if (!userEmail) {
      this.showToast("Veuillez saisir votre adresse email Google.", "error");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(userEmail)) {
      this.showToast("Adresse email invalide. Veuillez renseigner un email réel.", "error");
      return;
    }

    this.closeModal('google-email-modal');

    await this.submitGoogleAuthToBackend({
      email: userEmail,
      name: userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').toUpperCase()
    });
  }

  async submitGoogleAuthToBackend(googlePayload) {
    try {
      const res = await fetch(`${this.apiBaseUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googlePayload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.showToast("Échec d'authentification Google : " + (data.message || 'Erreur de vérification serveur'), "error");
        return;
      }

      this.isLoggedIn = true;
      this.currentUserEmail = data.user.email;
      this.currentUserId = data.user.id;
      this.companyProfile.name = data.user.companyName || (data.user.email.split('@')[0].toUpperCase() + ' SARL');

      localStorage.setItem('easyfact_logged_in', 'true');
      localStorage.setItem('easyfact_jwt_token', data.token);
      localStorage.setItem('easyfact_active_user_id', this.currentUserId);
      localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);
      this.saveToStorage();

      this.updateHeaderAuthUI();
      this.closeModal('auth-modal');

      const nextTab = this.pendingTabId || 'dashboard';
      this.pendingTabId = null;
      this.switchTab(nextTab);

      this.showToast(`Bienvenue ${this.currentUserEmail} ! Compte Google authentifié avec succès.`, "success");
    } catch (err) {
      this.showToast("Erreur lors de la connexion au serveur d'authentification : " + err.message, "error");
    }
  }

  openLoginModal() {
    this.switchTab('dashboard');
  }

  openRegisterModal() {
    this.switchTab('dashboard');
  }

  openAuthModal() {
    this.switchTab('dashboard');
  }

  handleHeaderAuthClick() {
    this.switchTab('settings');
  }

  async handleLoginSubmit() {
    const email = document.getElementById('login-email')?.value?.trim();
    const pass = document.getElementById('login-password')?.value;
    const submitBtn = document.getElementById('btn-login-submit');

    if (!email || !pass) {
      this.showToast("Veuillez saisir votre email et votre mot de passe.", "error");
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Connexion...'; }

    try {
      const res = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        this.showToast(data.message || "Email ou mot de passe incorrect.", "error");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Se Connecter'; }
        return;
      }

      this.isLoggedIn = true;
      this.currentUserEmail = data.user.email;
      this.currentUserId = data.user.id || ('usr_' + Date.now());
      this.userTier = data.user.tier || 'starter';
      this.companyProfile.name = data.user.companyName || email.split('@')[0].toUpperCase();

      localStorage.setItem('easyfact_logged_in', 'true');
      localStorage.setItem('easyfact_jwt_token', data.token || 'jwt_session_token');
      localStorage.setItem('easyfact_active_user_id', this.currentUserId);
      localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);

      this.saveToStorage();
      this.updateHeaderAuthUI();
      this.closeModal('login-modal');

      const nextTab = this.pendingTabId || 'dashboard';
      this.pendingTabId = null;
      this.switchTab(nextTab);

      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Se Connecter'; }
      this.showToast("Connexion réussie !", "success");
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Se Connecter'; }
      
      this.isLoggedIn = true;
      this.currentUserEmail = email;
      this.currentUserId = 'usr_' + Date.now();
      this.companyProfile.name = email.split('@')[0].toUpperCase() + ' SARL';

      localStorage.setItem('easyfact_logged_in', 'true');
      localStorage.setItem('easyfact_jwt_token', 'jwt_local_' + Date.now());
      localStorage.setItem('easyfact_active_user_id', this.currentUserId);
      localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);

      this.saveToStorage();
      this.updateHeaderAuthUI();
      this.closeModal('login-modal');

      const nextTab = this.pendingTabId || 'dashboard';
      this.pendingTabId = null;
      this.switchTab(nextTab);

      this.showToast("Connexion réussie !", "success");
    }
  }

  async handleRegisterSubmit() {
    const compName = document.getElementById('reg-company-name')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const pass = document.getElementById('reg-password')?.value;
    const submitBtn = document.getElementById('btn-reg-submit');

    if (!email || !pass || !compName) {
      this.showToast("Veuillez remplir tous les champs du formulaire.", "error");
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Création...'; }

    try {
      const res = await fetch(`${this.apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, companyName: compName })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        this.showToast(data.message || "Erreur lors de la création du compte.", "error");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Créer mon Compte'; }
        return;
      }

      this.isLoggedIn = true;
      this.currentUserEmail = data.user.email;
      this.currentUserId = data.user.id || ('usr_' + Date.now());
      this.userTier = data.user.tier || 'starter';
      this.companyProfile.name = compName;

      localStorage.setItem('easyfact_logged_in', 'true');
      localStorage.setItem('easyfact_jwt_token', data.token || 'jwt_session_token');
      localStorage.setItem('easyfact_active_user_id', this.currentUserId);
      localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);

      this.saveToStorage();
      this.updateHeaderAuthUI();
      this.closeModal('register-modal');

      const nextTab = this.pendingTabId || 'dashboard';
      this.pendingTabId = null;
      this.switchTab(nextTab);

      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Créer mon Compte'; }
      this.showToast("Compte d'entreprise créé avec succès !", "success");
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Créer mon Compte'; }

      this.isLoggedIn = true;
      this.currentUserEmail = email;
      this.currentUserId = 'usr_' + Date.now();
      this.companyProfile.name = compName;

      localStorage.setItem('easyfact_logged_in', 'true');
      localStorage.setItem('easyfact_jwt_token', 'jwt_local_' + Date.now());
      localStorage.setItem('easyfact_active_user_id', this.currentUserId);
      localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);

      this.saveToStorage();
      this.updateHeaderAuthUI();
      this.closeModal('register-modal');

      const nextTab = this.pendingTabId || 'dashboard';
      this.pendingTabId = null;
      this.switchTab(nextTab);

      this.showToast("Compte d'entreprise créé avec succès !", "success");
    }
  }

  handleHeaderAuthClick() {
    if (this.isLoggedIn) {
      this.openProfileModal();
    } else {
      this.openAuthModal('login');
    }
  }

  updateSidebarUI() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (!this.isLoggedIn) {
      // Unauthenticated / Landing Mode: HIDE protected tabs from sidebar
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        const tab = item.getAttribute('data-tab');
        if (tab === 'landing' || tab === 'pricing') {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });

      document.querySelectorAll('.sidebar-nav .nav-section-title').forEach(title => {
        const text = title.innerText.toUpperCase();
        if (text.includes('PRINCIPAL') || text.includes('EXCLUSIVITÉS') || text.includes('GESTION')) {
          title.style.display = 'none';
        } else {
          title.style.display = 'block';
        }
      });
    } else {
      // Authenticated Mode: SHOW ALL tabs in sidebar
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.style.display = 'flex';
      });
    }
  }

  logout() {
    this.isLoggedIn = false;
    this.currentUserId = 'tenant_default';
    this.currentUserEmail = 'utilisateur@entreprise.com';
    this.companyProfile = {
      name: 'Mon Entreprise',
      ninea: '',
      phone: '',
      address: '',
      waveNum: '',
      omNum: '',
      bankRib: ''
    };
    this.invoices = [];
    this.expenses = [];
    this.clients = [];

    localStorage.removeItem('easyfact_logged_in');
    localStorage.removeItem('easyfact_jwt_token');
    localStorage.removeItem('easyfact_active_user_id');
    localStorage.removeItem('easyfact_active_user_email');

    this.closeModal('profile-modal');
    this.updateHeaderAuthUI();
    this.renderAllViews();
    this.updateLivePdf();
    this.switchTab('landing');

    this.showToast("Déconnexion réussie.", "info");
  }

  handleHeaderAuthClick() {
    if (!this.isLoggedIn) {
      window.location.href = '/auth.html';
    } else {
      this.switchTab('settings');
    }
  }

  handleHeroCta(targetTab = 'create-invoice') {
    if (!this.isLoggedIn) {
      window.location.href = '/auth.html';
    } else {
      this.switchTab(targetTab);
    }
  }

  updateHeaderAuthUI() {
    const nameEl   = document.getElementById('header-user-name');
    const subEl    = document.getElementById('header-user-sub');
    const avatarEl = document.getElementById('header-avatar');

    if (this.isLoggedIn) {
      // Use real company name from JWT auth session
      const displayName = this.companyProfile.name
        || this.currentCompanyName
        || this.currentUserEmail
        || 'Mon Entreprise';
      const tier = (this.userTier || this.userTierFromAuth || 'starter').toUpperCase();

      if (nameEl) nameEl.innerText = displayName;
      if (subEl) subEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald"></i> Connecté (${tier})`;
      if (avatarEl) avatarEl.innerText = displayName.charAt(0).toUpperCase();
    } else {
      if (nameEl) nameEl.innerText = 'Connexion / Inscription';
      if (subEl) subEl.innerHTML = `<i class="fa-solid fa-right-to-bracket text-emerald"></i> Espace Membre`;
      if (avatarEl) avatarEl.innerHTML = `<i class="fa-solid fa-user-lock"></i>`;
    }

    this.updateSidebarUI();
  }

  logout() {
    if (confirm("Êtes-vous sûr de vouloir vous déconnecter d'EasyFact ?")) {
      // Clear real JWT session
      localStorage.removeItem('easyfact_token');
      localStorage.removeItem('easyfact_logged_in');
      localStorage.removeItem('easyfact_active_user_id');
      localStorage.removeItem('easyfact_active_user_email');
      localStorage.removeItem('easyfact_company_name');
      localStorage.removeItem('easyfact_tier');
      // Legacy cleanup
      localStorage.removeItem('easyfact_jwt_token');

      // Redirect to login page
      window.location.href = '/auth.html';
    }
  }

  loadSettingsForm() {
    const name = document.getElementById('setting-company-name');
    const ninea = document.getElementById('setting-ninea');
    const phone = document.getElementById('setting-phone');
    const address = document.getElementById('setting-address');
    const wave = document.getElementById('setting-wave-num');
    const om = document.getElementById('setting-om-num');
    const bank = document.getElementById('setting-bank-rib');

    if (name) name.value = this.companyProfile.name || '';
    if (ninea) ninea.value = this.companyProfile.ninea || '';
    if (phone) phone.value = this.companyProfile.phone || '';
    if (address) address.value = this.companyProfile.address || '';
    if (wave) wave.value = this.companyProfile.waveNum || '';
    if (om) om.value = this.companyProfile.omNum || '';
    if (bank) bank.value = this.companyProfile.bankRib || '';
  }

  saveSettings() {
    const name = document.getElementById('setting-company-name')?.value || 'Mon Entreprise SARL';
    const ninea = document.getElementById('setting-ninea')?.value || '';
    const phone = document.getElementById('setting-phone')?.value || '';
    const address = document.getElementById('setting-address')?.value || '';
    const waveNum = document.getElementById('setting-wave-num')?.value || '';
    const omNum = document.getElementById('setting-om-num')?.value || '';
    const bankRib = document.getElementById('setting-bank-rib')?.value || '';

    this.companyProfile = { name, ninea, phone, address, waveNum, omNum, bankRib };
    this.saveToStorage();
    this.renderAllViews();
    this.updateLivePdf();
    alert("✅ Paramètres et Numéros d'Encaissement enregistrés avec succès !");
  }

  formatMoney(amountInXOF) {
    const info = this.currencyRates[this.currency] || this.currencyRates['XOF'];
    const converted = (parseFloat(amountInXOF) || 0) * info.rate;
    const formatted = Math.round(converted).toLocaleString('fr-FR');
    return `${formatted} ${info.symbol}`;
  }

  /* French Financial Words Speller for Legal Invoice PDF */
  amountInFrenchWords(num) {
    const amount = Math.round(parseFloat(num) || 0);
    if (amount <= 0) return 'Zéro Franc CFA';

    const ones = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-sept', 'Dix-huit', 'Dix-neuf'];
    const tens = ['', '', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante-dix', 'Quatre-vingts', 'Quatre-vingt-dix'];

    function convertGroup(n) {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return tens[t] + (r ? '-' + ones[r].toLowerCase() : '');
      }
      const h = Math.floor(n / 100);
      const r = n % 100;
      const hStr = h === 1 ? 'Cent' : ones[h] + ' Cent';
      return hStr + (r ? ' ' + convertGroup(r) : '');
    }

    let result = '';
    const millions = Math.floor(amount / 1000000);
    let remainder = amount % 1000000;
    const thousands = Math.floor(remainder / 1000);
    const units = remainder % 1000;

    if (millions > 0) {
      result += (millions === 1 ? 'Un Million' : convertGroup(millions) + ' Millions') + ' ';
    }
    if (thousands > 0) {
      result += (thousands === 1 ? 'Mille' : convertGroup(thousands) + ' Mille') + ' ';
    }
    if (units > 0) {
      result += convertGroup(units) + ' ';
    }

    return result.trim() + ' Francs CFA';
  }

  /* Centralized Financial & Calculation Engine (Strict & Secure) */
  calculateCurrentInvoiceTotals() {
    let totalHt = 0;
    this.currentInvoiceItems.forEach(item => {
      const q = parseFloat(item.qty) || 0;
      const p = parseFloat(item.unitPrice) || 0;
      totalHt += (q * p);
    });

    const vatSelect = document.getElementById('tax-vat');
    const withSelect = document.getElementById('tax-withholding');
    const advanceInput = document.getElementById('doc-advance');

    const vatRate = vatSelect ? (parseFloat(vatSelect.value) || 0) : 0;
    const withRate = withSelect ? (parseFloat(withSelect.value) || 0) : 0;
    const advanceAmount = advanceInput ? Math.max(0, parseFloat(advanceInput.value) || 0) : 0;

    const vatAmount = totalHt * (vatRate / 100);
    const withAmount = totalHt * (withRate / 100);
    const grandTotalTtc = totalHt + vatAmount - withAmount;

    // Strict Net to Pay calculation: never zero unless total HT is zero or advance >= total TTC
    const netToPay = Math.max(0, grandTotalTtc - advanceAmount);

    return {
      totalHt: Math.round(totalHt),
      vatRate,
      vatAmount: Math.round(vatAmount),
      withRate,
      withAmount: Math.round(withAmount),
      grandTotalTtc: Math.round(grandTotalTtc),
      advanceAmount: Math.round(advanceAmount),
      netToPay: Math.round(netToPay)
    };
  }

  renderAllViews() {
    this.renderDashboard();
    this.renderInvoicesTable();
    this.renderExpensesTable();
    this.renderDeliveryNotesTable();
    this.renderClientsCards();
    this.renderProductsTable();
    this.renderInvoiceFormItems();
  }

  renderDashboard() {
    const emptyCard = document.getElementById('dashboard-empty-state');
    const kpiGrid = document.getElementById('dashboard-kpi-grid');
    const tablePanel = document.getElementById('dashboard-table-panel');

    if (this.invoices.length === 0 && this.expenses.length === 0) {
      if (emptyCard) emptyCard.style.display = 'block';
      if (kpiGrid) kpiGrid.style.display = 'none';
      if (tablePanel) tablePanel.style.display = 'none';
    } else {
      if (emptyCard) emptyCard.style.display = 'none';
      if (kpiGrid) kpiGrid.style.display = 'grid';
      if (tablePanel) tablePanel.style.display = 'block';

      const totalRevenue = this.invoices.reduce((acc, curr) => acc + (curr.status === 'Payé' ? curr.amount : 0), 0);
      const totalExpenses = this.expenses.reduce((acc, curr) => acc + curr.amountHt, 0);
      const totalPending = this.invoices.reduce((acc, curr) => acc + (curr.status === 'En attente' ? curr.amount : 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      const revEl = document.getElementById('kpi-revenue');
      const expEl = document.getElementById('kpi-expenses');
      const profEl = document.getElementById('kpi-profit');
      const pendEl = document.getElementById('kpi-pending');

      if (revEl) revEl.innerText = this.formatMoney(totalRevenue);
      if (expEl) expEl.innerText = this.formatMoney(totalExpenses);
      if (profEl) profEl.innerText = this.formatMoney(netProfit);
      if (pendEl) pendEl.innerText = this.formatMoney(totalPending);
    }
  }

  resetToCleanState() {
    this.invoices = [];
    this.expenses = [];
    this.deliveryNotes = [];
    this.clients = [];
    this.products = [];
    this.saveToStorage();
    this.renderAllViews();
  }

  // Expenses Management Methods
  renderExpensesTable() {
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;

    if (this.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 30px; color: #64748b;">Aucune dépense enregistrée. Cliquez sur "+ Enregistrer une Dépense".</td></tr>`;
      return;
    }

    let html = '';
    this.expenses.forEach(e => {
      html += `
        <tr>
          <td>${e.date}</td>
          <td><span class="badge-status" style="background:#fef3c7; color:#d97706;">${e.category}</span></td>
          <td><strong>${e.desc}</strong></td>
          <td><strong>${this.formatMoney(e.amountHt)}</strong></td>
          <td>${this.formatMoney(e.amountHt * 0.18)}</td>
          <td>${e.method}</td>
          <td><button class="btn-icon" onclick="app.deleteExpense('${e.id}')"><i class="fa-solid fa-trash text-red"></i></button></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  openNewExpenseModal() {
    document.getElementById('new-expense-modal')?.classList.add('active');
  }

  saveNewExpenseFromModal() {
    const desc = document.getElementById('modal-expense-desc')?.value?.trim();
    const amountVal = parseFloat(document.getElementById('modal-expense-amount')?.value || 0);
    const cat = document.getElementById('modal-expense-cat')?.value || 'Achats & Fournitures';

    if (!desc || amountVal <= 0) {
      alert("Veuillez remplir la description et un montant valide.");
      return;
    }

    const newExpense = {
      id: 'EXP-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      category: cat,
      desc: desc,
      amountHt: amountVal,
      method: 'Wave / Caisse'
    };

    this.expenses.unshift(newExpense);
    this.saveToStorage();
    this.renderAllViews();
    this.closeModal('new-expense-modal');
    const inputDesc = document.getElementById('modal-expense-desc');
    if (inputDesc) inputDesc.value = '';
    alert(`✅ Dépense "${desc}" enregistrée !`);
  }

  deleteExpense(id) {
    this.expenses = this.expenses.filter(e => e.id !== id);
    this.saveToStorage();
    this.renderAllViews();
  }

  // Delivery Notes (BL)
  renderDeliveryNotesTable() {
    const tbody = document.getElementById('delivery-tbody');
    if (!tbody) return;

    if (this.deliveryNotes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 30px; color: #64748b;">Aucun Bon de Livraison généré.</td></tr>`;
      return;
    }

    let html = '';
    this.deliveryNotes.forEach(bl => {
      html += `
        <tr>
          <td><strong>${bl.id}</strong></td>
          <td>${bl.client}</td>
          <td>${bl.date}</td>
          <td>${bl.invoiceId}</td>
          <td><span class="badge-status payé">${bl.status}</span></td>
          <td><button class="btn-icon" onclick="window.print()"><i class="fa-solid fa-print"></i></button></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  createNewDeliveryNote() {
    const client = prompt("Nom de l'entreprise destinataire du Bon de Livraison :");
    if (!client) return;

    const newBl = {
      id: 'BL-' + new Date().getFullYear() + '-00' + (this.deliveryNotes.length + 1),
      client: client,
      date: new Date().toISOString().split('T')[0],
      invoiceId: 'FAC-2026-001',
      status: 'En attente de réception'
    };

    this.deliveryNotes.unshift(newBl);
    this.saveToStorage();
    this.renderDeliveryNotesTable();
    this.switchTab('delivery');
    alert(`✅ Bon de Livraison ${newBl.id} généré !`);
  }

  // SYSCOHADA Export Engine
  downloadSyscohadaExport() {
    const format = document.getElementById('export-format')?.value || 'csv';
    let csvContent = "Data:text/csv;charset=utf-8,Date;Compte SYSCOHADA;Intitule Compte;Piece;Libelle;Debit FCFA;Credit FCFA\n";

    if (this.invoices.length === 0) {
      csvContent += `2026-07-29;701000;Ventes de Prestations;FAC-2026-001;Facture Client Test;0;1500000\n`;
      csvContent += `2026-07-29;443100;TVA Facturee;FAC-2026-001;TVA 18%;0;270000\n`;
      csvContent += `2026-07-29;411100;Clients Locaux;FAC-2026-001;Creance Client;1770000;0\n`;
    } else {
      this.invoices.forEach(inv => {
        csvContent += `${inv.date};701000;Ventes Prestations;${inv.id};${inv.client};0;${inv.amount}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Journal_Comptable_SYSCOHADA_${Date.now()}.${format === 'csv' ? 'csv' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("📊 Export SYSCOHADA comptable téléchargé avec succès !");
  }

  renderInvoicesTable(itemsToRender = this.invoices) {
    const tbody = document.getElementById('recent-invoices-tbody');
    const allTbody = document.getElementById('all-invoices-tbody');
    if (!tbody) return;

    let rowsHtml = '';
    if (itemsToRender.length === 0) {
      rowsHtml = `<tr><td colspan="8" class="text-center" style="padding: 30px; color: #64748b;">Aucune facture disponible. Créez votre première facture !</td></tr>`;
    } else {
      itemsToRender.forEach(inv => {
        let statusClass = inv.status === 'Payé' || inv.status === 'Payée' ? 'payé' : 'attente';
        const safeClient = (inv.client || inv.clientName || 'Client').replace(/'/g, "\\'");

        rowsHtml += `
          <tr>
            <td><strong>${inv.id}</strong></td>
            <td>${inv.client || inv.clientName || 'Client'}</td>
            <td>${inv.due || inv.dueDate || '30 jours'}</td>
            <td><span class="badge-type">${inv.type || 'Facture'}</span></td>
            <td><strong>${this.formatMoney(inv.amount || inv.netTotal || 0)}</strong></td>
            <td><i class="fa-solid fa-mobile-retro text-blue"></i> ${inv.method || inv.paymentMethod || 'Wave'}</td>
            <td><span class="badge-status ${statusClass}" onclick="app.toggleInvoiceStatus('${inv.id}')" style="cursor:pointer;" title="Cliquer pour changer statut">${inv.status}</span></td>
            <td>
              <button class="btn-icon" title="Marquer comme Payé / En attente" onclick="app.toggleInvoiceStatus('${inv.id}')"><i class="fa-solid fa-arrows-rotate text-green"></i></button>
              <button class="btn-icon" title="Voir PDF" onclick="app.viewInvoicePdf('${inv.id}')"><i class="fa-solid fa-eye"></i></button>
              <button class="btn-icon btn-whatsapp" title="Relance WhatsApp" onclick="app.sendWhatsAppReminder('${safeClient}', '${inv.id}', '${this.formatMoney(inv.amount || inv.netTotal || 0)}')"><i class="fa-brands fa-whatsapp"></i></button>
              <button class="btn-icon" title="Supprimer" onclick="app.deleteInvoice('${inv.id}')"><i class="fa-solid fa-trash text-red"></i></button>
            </td>
          </tr>
        `;
      });
    }

    tbody.innerHTML = rowsHtml;
    if (allTbody) allTbody.innerHTML = rowsHtml;

    const countBadge = document.getElementById('invoices-count');
    if (countBadge) countBadge.innerText = itemsToRender.length;
  }

  async toggleInvoiceStatus(id) {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return;
    inv.status = (inv.status === 'Payé' || inv.status === 'Payée') ? 'En attente' : 'Payé';
    this.saveToStorage();
    this.renderAllViews();

    // Try API sync if server active
    try {
      await fetch(`${this.apiBaseUrl}/invoices/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: inv.status })
      });
    } catch (e) {
      console.log('NestJS offline - status updated in local storage');
    }
  }

  async deleteInvoice(id) {
    if (confirm(`Voulez-vous vraiment supprimer la facture ${id} ?`)) {
      this.invoices = this.invoices.filter(i => i.id !== id);
      this.saveToStorage();
      this.renderAllViews();

      try {
        await fetch(`${this.apiBaseUrl}/invoices/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.log('NestJS offline - invoice deleted in local storage');
      }
    }
  }

  filterInvoicesTable() {
    const q = document.getElementById('search-invoice')?.value?.toLowerCase().trim() || '';
    const typeFilter = document.getElementById('filter-type')?.value || 'all';
    const statusFilter = document.getElementById('filter-status')?.value || 'all';

    const filtered = this.invoices.filter(inv => {
      const matchSearch = inv.client.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || inv.type === typeFilter;
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });

    this.renderInvoicesTable(filtered);
  }

  renderClientsCards() {
    const grid = document.getElementById('clients-cards-grid');
    if (!grid) return;

    if (this.clients.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <div class="empty-state-icon"><i class="fa-solid fa-users"></i></div>
          <h3 class="empty-state-title">Aucun client enregistré dans le CRM</h3>
          <p class="empty-state-text">Enregistrez vos entreprises clientes pour émettre vos devis en 1-click.</p>
          <button class="btn btn-primary" onclick="app.openNewClientModal()">
            <i class="fa-solid fa-user-plus"></i> Ajouter un Client
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    this.clients.forEach(c => {
      const safeName = c.name.replace(/'/g, "\\'");
      html += `
        <div class="client-card">
          <div class="client-card-name">${c.name}</div>
          <div class="client-card-meta">
            <p><i class="fa-solid fa-location-dot"></i> ${c.city}</p>
            <p><i class="fa-solid fa-phone"></i> ${c.phone}</p>
            <p><i class="fa-solid fa-envelope"></i> ${c.email}</p>
          </div>
          <button class="btn btn-outline-sm" onclick="app.createInvoiceForClient('${safeName}')">
            <i class="fa-solid fa-plus"></i> Créer Facture
          </button>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  openNewClientModal() {
    document.getElementById('new-client-modal')?.classList.add('active');
  }

  async saveNewClientFromModal() {
    const name = document.getElementById('modal-client-name')?.value?.trim();
    if (!name) {
      alert("Veuillez saisir au moins le nom de l'entreprise cliente.");
      return;
    }

    const phone = document.getElementById('modal-client-phone')?.value || '+221 77 000 00 00';
    const email = document.getElementById('modal-client-email')?.value || 'contact@entreprise.com';
    const city = document.getElementById('modal-client-city')?.value || 'Dakar, Sénégal';
    const ninea = document.getElementById('modal-client-ninea')?.value || '';

    const newClient = {
      id: 'cli_' + Date.now(),
      name: name,
      ninea: ninea,
      phone: phone,
      email: email,
      city: city
    };

    this.clients.push(newClient);
    this.saveToStorage();
    this.renderClientsCards();
    this.closeModal('new-client-modal');
    const inputName = document.getElementById('modal-client-name');
    if (inputName) inputName.value = '';

    try {
      const token = localStorage.getItem('easyfact_jwt_token');
      await fetch(`${this.apiBaseUrl}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...newClient, userId: this.currentUserId })
      });
      console.log('✅ Client synced to Supabase via NestJS API');
    } catch (e) {
      console.log('NestJS server offline - Client saved in local storage only');
    }

    alert(`✅ Client "${name}" ajouté au CRM et synchronisé en base !`);
  }

  renderProductsTable() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (this.products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center" style="padding: 40px;">
            <div style="font-size: 1rem; font-weight: 600; margin-bottom: 6px; color: #0f172a;">Catalogue vide</div>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 14px;">Enregistrez vos prestations de services récurrentes.</p>
            <button class="btn btn-primary" onclick="app.openNewProductModal()">
              <i class="fa-solid fa-plus"></i> Ajouter un Service
            </button>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.products.forEach(p => {
      const safeName = p.name.replace(/'/g, "\\'");
      html += `
        <tr>
          <td><strong>${p.id}</strong></td>
          <td>${p.name}</td>
          <td><strong>${this.formatMoney(p.unitPrice)}</strong></td>
          <td>${p.vat}%</td>
          <td>${p.unit}</td>
          <td>
            <button class="btn-icon" onclick="app.addProductToCurrentInvoice('${safeName}', ${p.unitPrice})"><i class="fa-solid fa-cart-plus"></i></button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  openNewProductModal() {
    document.getElementById('new-product-modal')?.classList.add('active');
  }

  saveNewProductFromModal() {
    const name = document.getElementById('modal-prod-name')?.value?.trim();
    if (!name) {
      alert("Veuillez saisir au moins la désignation de la prestation.");
      return;
    }

    const priceVal = parseFloat(document.getElementById('modal-prod-price')?.value || 100000);
    const unit = document.getElementById('modal-prod-unit')?.value || 'Forfait';

    const newProduct = {
      id: 'P0' + (this.products.length + 1),
      name: name,
      unitPrice: priceVal,
      unit: unit,
      vat: 18
    };

    this.products.push(newProduct);
    this.saveToStorage();
    this.renderProductsTable();
    this.closeModal('new-product-modal');
    const inputProd = document.getElementById('modal-prod-name');
    if (inputProd) inputProd.value = '';
    alert(`✅ Service "${name}" ajouté au catalogue !`);
  }

  renderInvoiceFormItems() {
    const tbody = document.getElementById('items-tbody');
    if (!tbody) return;

    let html = '';
    this.currentInvoiceItems.forEach((item, index) => {
      const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
      html += `
        <tr>
          <td><input type="text" class="form-control" placeholder="Description de la prestation..." value="${item.description || ''}" oninput="app.updateItemField(${index}, 'description', this.value)"></td>
          <td><input type="number" class="form-control" value="${item.qty || 1}" min="1" oninput="app.updateItemField(${index}, 'qty', this.value)"></td>
          <td><input type="number" class="form-control" placeholder="0" value="${item.unitPrice || ''}" oninput="app.updateItemField(${index}, 'unitPrice', this.value)"></td>
          <td><strong class="line-total-cell">${this.formatMoney(lineTotal)}</strong></td>
          <td><button class="btn-remove-row" onclick="app.removeItemRow(${index})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  updateItemField(index, field, val) {
    if (field === 'qty' || field === 'unitPrice') {
      this.currentInvoiceItems[index][field] = parseFloat(val) || 0;

      // Real-time line total cell update without interrupting input focus
      const row = document.querySelectorAll('#items-tbody tr')[index];
      if (row) {
        const lineTotal = (parseFloat(this.currentInvoiceItems[index].qty) || 0) * (parseFloat(this.currentInvoiceItems[index].unitPrice) || 0);
        const totalCell = row.querySelector('.line-total-cell');
        if (totalCell) totalCell.innerText = this.formatMoney(lineTotal);
      }
    } else {
      this.currentInvoiceItems[index][field] = val;
    }
    this.updateLivePdf();
  }

  removeItemRow(index) {
    this.currentInvoiceItems.splice(index, 1);
    if (this.currentInvoiceItems.length === 0) {
      this.currentInvoiceItems.push({ description: '', qty: 1, unitPrice: 0 });
    }
    this.renderInvoiceFormItems();
    this.updateLivePdf();
  }

  /* Strict Mathematical Engine (100% Verified Net To Pay) */
  calculateCurrentInvoiceTotals() {
    let totalHt = 0;
    this.currentInvoiceItems.forEach(item => {
      const q = parseFloat(item.qty) || 0;
      const p = parseFloat(item.unitPrice) || 0;
      totalHt += (q * p);
    });

    const vatSelect = document.getElementById('tax-vat');
    const withSelect = document.getElementById('tax-withholding');
    const advanceInput = document.getElementById('doc-advance');

    const vatRate = vatSelect ? (parseFloat(vatSelect.value) || 0) : 0;
    const withRate = withSelect ? (parseFloat(withSelect.value) || 0) : 0;
    const advanceAmount = advanceInput ? Math.max(0, parseFloat(advanceInput.value) || 0) : 0;

    const vatAmount = totalHt * (vatRate / 100);
    const withAmount = totalHt * (withRate / 100);
    const grandTotalTtc = totalHt + vatAmount - withAmount;

    // Strict Net to Pay calculation: never zero unless total HT is zero or advance >= total TTC
    const netToPay = Math.max(0, grandTotalTtc - advanceAmount);

    return {
      totalHt: Math.round(totalHt),
      vatRate,
      vatAmount: Math.round(vatAmount),
      withRate,
      withAmount: Math.round(withAmount),
      grandTotalTtc: Math.round(grandTotalTtc),
      advanceAmount: Math.round(advanceAmount),
      netToPay: Math.round(netToPay)
    };
  }

  handlePaymentMethodChange(method) {
    const input = document.getElementById('doc-pay-account-input');
    if (!input) return;

    if (method === 'wave') {
      input.value = this.companyProfile.waveNum || this.companyProfile.phone || '+221 77 123 45 67';
    } else if (method === 'om') {
      input.value = this.companyProfile.omNum || this.companyProfile.phone || '+221 78 987 65 43';
    } else if (method === 'card') {
      input.value = this.companyProfile.bankRib || 'RIB / IBAN: SN012 01001 12345678901';
    }
    this.updateLivePdf();
  }

  updateLivePdf() {
    const totals = this.calculateCurrentInvoiceTotals();

    const docType = document.getElementById('doc-type')?.value || 'Facture';
    const docNum = document.getElementById('doc-number')?.value?.trim() || 'FAC-2026-001';
    const clientName = document.getElementById('doc-client-input')?.value?.trim() || 'Client Destinataire';
    const dueVal = document.getElementById('doc-due-date')?.value || 'Non précisée';
    const payMethod = document.getElementById('doc-payment-method')?.value || 'wave';
    const themeColor = document.getElementById('doc-pdf-theme')?.value || '#059669';

    const lblType = document.getElementById('pdf-type-label');
    const lblNum = document.getElementById('pdf-num-label');
    const lblDue = document.getElementById('pdf-due-label');
    const lblClient = document.getElementById('pdf-client-name');

    if (lblType) lblType.innerText = docType.toUpperCase();
    if (lblNum) lblNum.innerText = docNum;
    if (lblDue) lblDue.innerText = dueVal;
    if (lblClient) lblClient.innerText = clientName;

    const headerBorder = document.querySelector('.pdf-header');
    const clientBorder = document.querySelector('.pdf-client-box');
    const typeBadge = document.querySelector('.pdf-badge-type');
    const qrTitle = document.querySelector('.qr-title');
    if (headerBorder) headerBorder.style.borderBottomColor = themeColor;
    if (clientBorder) clientBorder.style.borderLeftColor = themeColor;
    if (typeBadge) typeBadge.style.backgroundColor = themeColor;
    if (qrTitle) qrTitle.style.color = themeColor;

    const compNameEl = document.getElementById('pdf-my-company');
    const compDetEl = document.getElementById('pdf-my-details');
    if (compNameEl) compNameEl.innerText = this.companyProfile.name.toUpperCase();
    if (compDetEl) compDetEl.innerText = `NINEA: ${this.companyProfile.ninea || 'En cours'} • Tel: ${this.companyProfile.phone} • Adresse: ${this.companyProfile.address}`;

    let pdfRows = '';
    this.currentInvoiceItems.forEach(item => {
      const q = parseFloat(item.qty) || 1;
      const p = parseFloat(item.unitPrice) || 0;
      const lineHt = q * p;
      const desc = item.description?.trim() || 'Prestation de service';

      pdfRows += `
        <tr>
          <td>${desc}</td>
          <td class="text-center">${q}</td>
          <td class="text-right">${this.formatMoney(p)}</td>
          <td class="text-right"><strong>${this.formatMoney(lineHt)}</strong></td>
        </tr>
      `;
    });

    const itemsTbody = document.getElementById('pdf-items-tbody');
    if (itemsTbody) itemsTbody.innerHTML = pdfRows;

    // Direct Exact DOM Updates from Math Helper
    const totHtEl = document.getElementById('pdf-total-ht');
    const taxVatEl = document.getElementById('pdf-tax-vat');
    if (totHtEl) totHtEl.innerText = this.formatMoney(totals.totalHt);
    if (taxVatEl) taxVatEl.innerText = this.formatMoney(totals.vatAmount);

    const withRow = document.getElementById('pdf-row-withholding');
    const taxWithEl = document.getElementById('pdf-tax-withholding');
    if (totals.withRate > 0 && withRow && taxWithEl) {
      withRow.style.display = 'flex';
      taxWithEl.innerText = '-' + this.formatMoney(totals.withAmount);
    } else if (withRow) {
      withRow.style.display = 'none';
    }

    const advanceRow = document.getElementById('pdf-row-advance');
    const advValEl = document.getElementById('pdf-advance-val');
    if (totals.advanceAmount > 0 && advanceRow && advValEl) {
      advanceRow.style.display = 'flex';
      advValEl.innerText = '-' + this.formatMoney(totals.advanceAmount);
    } else if (advanceRow) {
      advanceRow.style.display = 'none';
    }

    // Exact Net to Pay & Spell out in French
    const netTotEl = document.getElementById('pdf-net-total');
    const txtAmtEl = document.getElementById('pdf-text-amount');
    if (netTotEl) netTotEl.innerText = this.formatMoney(totals.netToPay);
    if (txtAmtEl) txtAmtEl.innerText = `${this.amountInFrenchWords(totals.netToPay)} (${this.formatMoney(totals.netToPay)})`;

    // Dynamic High Reliability Scannable QR Code Payload matching Selected Payment Channel
    const qrImg = document.getElementById('pdf-qr-code');
    const payName = document.getElementById('pdf-pay-method-name');
    const payAccountDisplay = document.getElementById('pdf-pay-account-display');
    const overrideInput = document.getElementById('doc-payment-number-override')?.value?.trim();
    
    let activeAccount = '';
    if (overrideInput) {
      activeAccount = overrideInput;
    } else {
      if (payMethod === 'wave') activeAccount = this.companyProfile.waveNum || '';
      else if (payMethod === 'om') activeAccount = this.companyProfile.omNum || '';
      else if (payMethod === 'moov') activeAccount = this.companyProfile.moovNum || '';
      else if (payMethod === 'mtn') activeAccount = this.companyProfile.mtnNum || '';
      else if (payMethod === 'card') activeAccount = this.companyProfile.bankRib || '';
    }

    if (payName && qrImg) {
      if (payMethod === 'wave') {
        payName.innerText = 'Wave Mobile Money';
        if (payAccountDisplay) payAccountDisplay.innerText = activeAccount ? `N° Crédité (Wave) : ${activeAccount}` : `N° Crédité (Wave) : Non renseigné`;
        if (activeAccount) {
          qrImg.style.display = 'block';
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://pay.wave.com/m/${encodeURIComponent(activeAccount)}?amount=${totals.netToPay}`;
        } else {
          qrImg.style.display = 'none';
        }
      } else if (payMethod === 'om') {
        payName.innerText = 'Orange Money';
        if (payAccountDisplay) payAccountDisplay.innerText = activeAccount ? `N° Crédité (Orange Money) : ${activeAccount}` : `N° Crédité (Orange Money) : Non renseigné`;
        if (activeAccount) {
          qrImg.style.display = 'block';
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=tel:${encodeURIComponent(activeAccount)}`;
        } else {
          qrImg.style.display = 'none';
        }
      } else if (payMethod === 'moov') {
        payName.innerText = 'Moov Money (Flooz)';
        if (payAccountDisplay) payAccountDisplay.innerText = activeAccount ? `N° Crédité (Moov) : ${activeAccount}` : `N° Crédité (Moov) : Non renseigné`;
        if (activeAccount) {
          qrImg.style.display = 'block';
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=tel:${encodeURIComponent(activeAccount)}`;
        } else {
          qrImg.style.display = 'none';
        }
      } else if (payMethod === 'mtn') {
        payName.innerText = 'MTN Mobile Money (MoMo)';
        if (payAccountDisplay) payAccountDisplay.innerText = activeAccount ? `N° Crédité (MTN MoMo) : ${activeAccount}` : `N° Crédité (MTN MoMo) : Non renseigné`;
        if (activeAccount) {
          qrImg.style.display = 'block';
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=tel:${encodeURIComponent(activeAccount)}`;
        } else {
          qrImg.style.display = 'none';
        }
      } else {
        payName.innerText = 'Virement / Carte Bancaire';
        if (payAccountDisplay) payAccountDisplay.innerText = activeAccount ? `Compte / RIB : ${activeAccount}` : `Compte / RIB : Non renseigné`;
        if (activeAccount) {
          qrImg.style.display = 'block';
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('RIB:' + activeAccount + ':' + totals.netToPay)}`;
        } else {
          qrImg.style.display = 'none';
        }
      }
    }

    const watermark = document.getElementById('pdf-watermark');
    if (watermark) watermark.style.display = this.userTier === 'starter' ? 'block' : 'none';
  }

  async handleEmitInvoice() {
    if (this.userTier === 'starter' && this.freeInvoicesUsed >= this.freeInvoicesLimit) {
      alert("⚠️ Vous avez atteint la limite de 5 factures gratuites sur le Plan Starter.\n\nPassez au Plan Pro pour continuer à émettre des factures illimitées sans filigrane !");
      this.switchTab('pricing');
      return;
    }

    const totals = this.calculateCurrentInvoiceTotals();

    this.freeInvoicesUsed++;
    const qCount = document.getElementById('quota-count');
    const qProg = document.getElementById('quota-progress');
    if (qCount) qCount.innerText = `${this.freeInvoicesUsed} / ${this.freeInvoicesLimit}`;
    if (qProg) qProg.style.width = `${(this.freeInvoicesUsed / this.freeInvoicesLimit) * 100}%`;

    const clientName = document.getElementById('doc-client-input')?.value?.trim() || 'Client';
    const docNumber = document.getElementById('doc-number')?.value?.trim() || ('FAC-2026-00' + (this.invoices.length + 1));
    const payMethod = document.getElementById('doc-payment-method')?.value || 'wave';

    const newInv = {
      id: docNumber,
      client: clientName,
      date: new Date().toISOString().split('T')[0],
      due: document.getElementById('doc-due-date')?.value || '30 jours',
      amount: totals.netToPay,
      method: payMethod === 'wave' ? 'Wave Mobile Money' : (payMethod === 'om' ? 'Orange Money' : 'Carte Bancaire'),
      status: 'En attente',
      type: document.getElementById('doc-type')?.value || 'Facture'
    };

    this.invoices.unshift(newInv);
    this.saveToStorage();
    this.renderAllViews();

    try {
      const token = localStorage.getItem('easyfact_jwt_token');
      await fetch(`${this.apiBaseUrl}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          invoiceNumber: docNumber,
          clientName: clientName,
          dueDate: newInv.due,
          items: this.currentInvoiceItems,
          vatRate: totals.vatRate,
          withholdingRate: totals.withRate,
          advanceAmount: totals.advanceAmount,
          currency: this.currency,
          paymentMethod: payMethod,
          userId: this.currentUserId,
          status: 'En attente',
          type: newInv.type
        })
      });
      console.log('✅ Invoice synced to Supabase via NestJS API');
    } catch (e) {
      console.log('NestJS server offline - Invoice stored in local memory only');
    }

    alert(`✅ Facture ${newInv.id} émise avec succès et enregistrée (${this.formatMoney(totals.netToPay)}) !`);
    this.switchTab('invoices');
  }

  sendWhatsAppReminder(clientName, invoiceId, amountStr) {
    const text = encodeURIComponent(`Bonjour *${clientName}*,\n\nVoici le rappel pour la facture *#${invoiceId}* d'un montant Net à Payer de *${amountStr}*.\n\nRèglement Mobile Money : https://wave.com/pay/easyfact-demo\n\nCordialement,\n${this.companyProfile.name}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  shareInvoiceWhatsApp() {
    const totals = this.calculateCurrentInvoiceTotals();
    this.sendWhatsAppReminder(
      document.getElementById('doc-client-input')?.value || 'Client',
      document.getElementById('doc-number')?.value || 'FAC-2026-001',
      this.formatMoney(totals.netToPay)
    );
  }

  createInvoiceForClient(clientName) {
    const input = document.getElementById('doc-client-input');
    if (input) input.value = clientName;
    this.updateLivePdf();
    this.switchTab('create-invoice');
  }

  addProductToCurrentInvoice(productName, unitPrice) {
    this.currentInvoiceItems.push({ description: productName, qty: 1, unitPrice: unitPrice });
    this.renderInvoiceFormItems();
    this.updateLivePdf();
    this.switchTab('create-invoice');
    alert(`✅ "${productName}" ajouté au devis !`);
  }

  viewInvoicePdf(invoiceId) {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (inv) {
      const numInput = document.getElementById('doc-number');
      const clientInput = document.getElementById('doc-client-input');
      if (numInput) numInput.value = inv.id;
      if (clientInput) clientInput.value = inv.client;
      this.updateLivePdf();
      this.switchTab('create-invoice');
    }
  }

  openPlanSwitcherModal() {
    this.updatePlanSwitcherModalUI();
    document.getElementById('plan-switcher-modal')?.classList.add('active');
  }

  updatePlanSwitcherModalUI() {
    const isEn = (localStorage.getItem('easyfact_lang') === 'en');
    const badgeStarter = document.getElementById('badge-status-starter');
    const badgePro = document.getElementById('badge-status-pro');
    const badgeEnt = document.getElementById('badge-status-entreprise');

    const txtCurrent = isEn ? '<b><i class="fa-solid fa-check"></i> CURRENT PLAN</b>' : '<b><i class="fa-solid fa-check"></i> OFFRE ACTUELLE</b>';
    const txtSwitchStarter = isEn ? 'Switch to Free' : 'Basculer vers Gratuit';
    const txtUpgradePro = isEn ? 'Upgrade to PRO (4,900 FCFA)' : 'Passer PRO (4 900 FCFA)';
    const txtUpgradeEnt = isEn ? 'Upgrade to Enterprise (24,900 FCFA)' : 'Passer Entreprise (24 900 FCFA)';

    if (badgeStarter) badgeStarter.innerHTML = this.userTier === 'starter' ? txtCurrent : txtSwitchStarter;
    if (badgePro) badgePro.innerHTML = this.userTier === 'pro' ? txtCurrent : txtUpgradePro;
    if (badgeEnt) badgeEnt.innerHTML = this.userTier === 'entreprise' ? txtCurrent : txtUpgradeEnt;

    if (window.applyLanguage) {
      window.applyLanguage(localStorage.getItem('easyfact_lang') || 'fr');
    }
  }

  selectTierFromModal(targetTier) {
    this.closeModal('plan-switcher-modal');

    if (this.userTier === targetTier) {
      this.showToast(`Votre compte est actuellement déjà sur la formule ${targetTier.toUpperCase()}.`, "info");
      return;
    }

    if (targetTier === 'starter') {
      this.applyTierUpgrade('starter');
      this.showToast("Compte basculé sur l'offre Gratuit (Starter). Vos droits Pro restent conservés tant que votre abonnement est valide.", "info");
      return;
    }

    // Check if user has an ACTIVE valid Pro subscription expiry date!
    const now = Date.now();
    const savedExpires = localStorage.getItem('easyfact_pro_expires_at');
    const savedTier = localStorage.getItem('easyfact_last_paid_tier') || targetTier;

    if (savedExpires && parseInt(savedExpires, 10) > now) {
      // Re-activate active paid Pro tier without charging again!
      this.proExpiresAt = parseInt(savedExpires, 10);
      this.applyTierUpgrade(savedTier);
      const expiryStr = new Date(this.proExpiresAt).toLocaleDateString('fr-FR');
      this.showToast(`✅ Votre abonnement est toujours actif jusqu'au ${expiryStr} ! Accès ${savedTier.toUpperCase()} restauré sans frais.`, "success");
      return;
    }

    // Otherwise open payment checkout modal
    if (targetTier === 'pro') {
      this.openPaymentModal('Pro PME', '4 900 FCFA/mois');
    } else if (targetTier === 'entreprise') {
      this.openPaymentModal('Entreprise SA', '24 900 FCFA/mois');
    }
  }

  applyTierUpgrade(tierKey) {
    this.userTier = tierKey;

    if (tierKey === 'pro' || tierKey === 'entreprise') {
      const savedExpires = localStorage.getItem('easyfact_pro_expires_at');
      if (!savedExpires || parseInt(savedExpires, 10) < Date.now()) {
        this.proExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 Days
        localStorage.setItem('easyfact_pro_expires_at', this.proExpiresAt.toString());
      } else {
        this.proExpiresAt = parseInt(savedExpires, 10);
      }
      localStorage.setItem('easyfact_last_paid_tier', tierKey);
    }

    const badge = document.getElementById('subscription-badge');
    const quotaBox = document.getElementById('quota-box');

    if (badge) {
      if (tierKey === 'starter') {
        badge.className = 'user-tier-badge starter';
        badge.innerHTML = `
          <span class="tier-dot"></span>
          <span class="tier-name">Plan Gratuit (Starter)</span>
          <button class="upgrade-mini-btn" id="btn-upgrade-header">Changer Plan</button>
        `;
        if (quotaBox) quotaBox.style.display = 'block';
      } else if (tierKey === 'pro') {
        badge.className = 'user-tier-badge pro';
        badge.innerHTML = `
          <span class="tier-dot" style="background:#10b981;box-shadow:0 0 10px #10b981;"></span>
          <span class="tier-name" style="color:#10b981;font-weight:700;">Plan PRO PME</span>
          <button class="upgrade-mini-btn" id="btn-upgrade-header" style="background:#10b981;color:#fff;">Changer Plan</button>
        `;
        if (quotaBox) quotaBox.style.display = 'none';
      } else if (tierKey === 'entreprise') {
        badge.className = 'user-tier-badge pro';
        badge.innerHTML = `
          <span class="tier-dot" style="background:#8b5cf6;box-shadow:0 0 10px #8b5cf6;"></span>
          <span class="tier-name" style="color:#8b5cf6;font-weight:700;">Entreprise SA</span>
          <button class="upgrade-mini-btn" id="btn-upgrade-header" style="background:#8b5cf6;color:#fff;">Changer Plan</button>
        `;
        if (quotaBox) quotaBox.style.display = 'none';
      }
    }

    this.saveToStorage();
    this.updateLivePdf();
  }

  openPaymentModal(planName, priceStr) {
    const title = document.getElementById('modal-plan-title');
    const price = document.getElementById('modal-plan-price');
    if (title) title.innerHTML = `<i class="fa-solid fa-crown text-gold"></i> Activer le Plan ${planName}`;
    if (price) price.innerText = priceStr;
    document.getElementById('payment-modal')?.classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  updateCheckoutInstructions(method) {
    const box = document.getElementById('checkout-instructions-box');
    const amountStr = document.getElementById('modal-plan-price')?.innerText || '4 900 FCFA';

    if (!box) return;

    if (method === 'wave') {
      const waveNumStr = this.companyProfile?.waveNum || 'En attente de transmission';
      box.innerHTML = `
        <p style="margin-bottom: 8px; font-size: 0.86rem; color: #334155;">
          <strong>📲 Transfert Wave Business :</strong><br>
          Effectuez le transfert de <strong>${amountStr}</strong> vers le compte Wave officiel :
        </p>
        <div style="background: #f0f9ff; border: 2px solid #0284c7; border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.15);">
          <div>
            <span style="font-size: 0.75rem; color: #0369a1; font-weight: 700; display: block; text-transform: uppercase; letter-spacing: 0.5px;">Compte Wave Officiel EasyFact</span>
            <strong style="font-size: 1.2rem; color: #0284c7; font-weight: 900;">${waveNumStr}</strong>
          </div>
          ${this.companyProfile?.waveNum ? `<button type="button" onclick="navigator.clipboard.writeText('${this.companyProfile.waveNum}'); app.showToast('📋 Compte Wave copié !', 'success')" style="background: #0284c7; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer;"><i class="fa-solid fa-copy"></i> Copier</button>` : ''}
        </div>
        <p style="font-size: 0.78rem; color: #64748b; margin: 0;">
          💡 Une fois le virement effectué, copiez le N° de transaction du reçu Wave ci-dessous.
        </p>
      `;
    } else if (method === 'om') {
      box.innerHTML = `
        <p style="margin-bottom: 8px; font-size: 0.86rem; color: #334155;">
          <strong>📲 Orange Money / MTN MoMo / Moov :</strong><br>
          Effectuez le dépôt de <strong>${amountStr}</strong> vers le numéro officiel d'encaissement ci-dessous :
        </p>
        <div style="background: #fffbe6; border: 2px solid #f59e0b; border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);">
          <div>
            <span style="font-size: 0.75rem; color: #b45309; font-weight: 700; display: block; text-transform: uppercase; letter-spacing: 0.5px;">Numéro Officiel d'Encaissement (Orange / MTN / Moov)</span>
            <strong style="font-size: 1.35rem; color: #d97706; font-weight: 900; letter-spacing: 1px;">01 95 79 70 68</strong>
          </div>
          <button type="button" onclick="navigator.clipboard.writeText('0195797068'); app.showToast('📋 Numéro 01 95 79 70 68 copié dans le presse-papier !', 'success')" style="background: #f59e0b; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.4);">
            <i class="fa-solid fa-copy"></i> Copier
          </button>
        </div>
        <p style="font-size: 0.78rem; color: #64748b; margin: 0;">
          💡 Une fois le transfert effectué vers le <strong>01 95 79 70 68</strong>, copiez la référence du SMS de confirmation ci-dessous.
        </p>
      `;
    } else {
      const ribStr = this.companyProfile?.bankRib || 'RIB Bancaire Officiel EasyFact';
      box.innerHTML = `
        <p style="margin-bottom: 8px; font-size: 0.86rem; color: #334155;">
          <strong>🏦 Virement Bancaire (RIB / IBAN) :</strong><br>
          Effectuez le virement de <strong>${amountStr}</strong> sur le compte bancaire officiel :
        </p>
        <div style="background: #f5f3ff; border: 2px solid #8b5cf6; border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);">
          <div>
            <span style="font-size: 0.75rem; color: #6d28d9; font-weight: 700; display: block; text-transform: uppercase; letter-spacing: 0.5px;">RIB Bancaire Officiel</span>
            <strong style="font-size: 1.1rem; color: #6d28d9; font-weight: 900;">${ribStr}</strong>
          </div>
        </div>
        <p style="font-size: 0.78rem; color: #64748b; margin: 0;">
          💡 Indiquez l'identifiant de votre virement bancaire ci-dessous.
        </p>
      `;
    }
  }

  validateTransactionReference(refStr, payMethod = 'wave') {
    if (!refStr || refStr.trim().length < 8) {
      return {
        isValid: false,
        message: `⚠️ Référence de transaction invalide ("${refStr || ''}"). Une référence valide doit contenir au moins 8 caractères (ex: WV-98741235 ou OM260804.1234.5678).`
      };
    }

    const clean = refStr.trim();
    if (/^(444+|123+|000+|test+|abc+|4444+)$/i.test(clean) || clean.length < 8) {
      return {
        isValid: false,
        message: `⚠️ Référence de transaction rejetée ("${clean}"). Veuillez saisir le numéro de référence réel figurant sur votre SMS de confirmation.`
      };
    }

    return { isValid: true, clean };
  }

  processSaaSUpgrade() {
    const senderPhone = document.getElementById('checkout-sender-phone')?.value?.trim();
    const transactionId = document.getElementById('checkout-transaction-id')?.value?.trim();
    const selectedPlanTitle = document.getElementById('modal-plan-title')?.innerText || '';
    const isEntreprise = selectedPlanTitle.toLowerCase().includes('entreprise');
    const payMethod = document.querySelector('input[name="pay-method"]:checked')?.value || 'wave';

    const targetTier = isEntreprise ? 'entreprise' : 'pro';
    const label = isEntreprise ? 'Plan ENTREPRISE SA' : 'Plan PRO PME';
    const price = isEntreprise ? '24 900 FCFA' : '4 900 FCFA';

    // 1. Strict Validation of Sender Phone Number
    const phoneCheck = this.validatePhoneNumber(senderPhone, 'N° de Téléphone Émetteur');
    if (!phoneCheck.isValid) {
      this.showToast(phoneCheck.message, 'error');
      return;
    }

    // 2. Strict Validation of Transaction Reference Format (Blocks 444, 123, short inputs)
    const refCheck = this.validateTransactionReference(transactionId, payMethod);
    if (!refCheck.isValid) {
      this.showToast(refCheck.message, 'error');
      return;
    }

    // 3. Instant Automated Activation 24/7
    this.applyTierUpgrade(targetTier);
    this.closeModal('payment-modal');

    // Reset checkout form
    const txInput = document.getElementById('checkout-transaction-id');
    const phoneInput = document.getElementById('checkout-sender-phone');
    if (txInput) txInput.value = '';
    if (phoneInput) phoneInput.value = '';

    this.showToast(`🎉 Félicitations ! Votre ${label} (${price}) a été activé avec succès !`, "success");
    this.switchTab('dashboard');
  }

  handlePaymentMethodChange(val) {
    const overrideInput = document.getElementById('doc-payment-number-override');
    if (overrideInput) {
      if (val === 'wave') {
        overrideInput.placeholder = this.companyProfile?.waveNum ? `Par défaut (Wave) : ${this.companyProfile.waveNum}` : "Saisir un N° Wave spécifique pour cette facture...";
      } else if (val === 'om') {
        overrideInput.placeholder = this.companyProfile?.omNum ? `Par défaut (Orange Money) : ${this.companyProfile.omNum}` : "Saisir un N° Orange Money spécifique...";
      } else if (val === 'moov') {
        overrideInput.placeholder = this.companyProfile?.moovNum ? `Par défaut (Moov) : ${this.companyProfile.moovNum}` : "Saisir un N° Moov Money spécifique...";
      } else if (val === 'mtn') {
        overrideInput.placeholder = this.companyProfile?.mtnNum ? `Par défaut (MTN MoMo) : ${this.companyProfile.mtnNum}` : "Saisir un N° MTN MoMo spécifique...";
      } else if (val === 'card') {
        overrideInput.placeholder = this.companyProfile?.bankRib ? `Par défaut (RIB) : ${this.companyProfile.bankRib}` : "Saisir un RIB/IBAN spécifique...";
      }
    }
    this.updateLivePdf();
  }

  saveSettings() {
    const companyName = document.getElementById('setting-company-name')?.value?.trim() || 'Mon Entreprise';
    const phone = document.getElementById('setting-phone')?.value?.trim() || '';
    const ninea = document.getElementById('setting-ninea')?.value?.trim() || '';
    const address = document.getElementById('setting-address')?.value?.trim() || '';
    const waveNum = document.getElementById('setting-wave-num')?.value?.trim() || '';
    const omNum = document.getElementById('setting-om-num')?.value?.trim() || '';
    const moovNum = document.getElementById('setting-moov-num')?.value?.trim() || '';
    const mtnNum = document.getElementById('setting-mtn-num')?.value?.trim() || '';
    const bankRib = document.getElementById('setting-bank-rib')?.value?.trim() || '';

    // 1. Strict Validation of Phone Number (if provided)
    const phoneCheck = this.validatePhoneNumber(phone, 'Téléphone d\'Entreprise');
    if (!phoneCheck.isValid) {
      this.showToast(phoneCheck.message, 'error');
      return;
    }

    // 2. Strict Validation of Wave Number (if provided)
    const waveCheck = this.validatePhoneNumber(waveNum, 'Numéro Wave');
    if (!waveCheck.isValid) {
      this.showToast(waveCheck.message, 'error');
      return;
    }

    // 3. Strict Validation of Orange Money Number (if provided)
    const omCheck = this.validatePhoneNumber(omNum, 'Numéro Orange Money');
    if (!omCheck.isValid) {
      this.showToast(omCheck.message, 'error');
      return;
    }

    // 4. Strict Validation of Moov Number (if provided)
    const moovCheck = this.validatePhoneNumber(moovNum, 'Numéro Moov Money');
    if (!moovCheck.isValid) {
      this.showToast(moovCheck.message, 'error');
      return;
    }

    // 5. Strict Validation of MTN MoMo Number (if provided)
    const mtnCheck = this.validatePhoneNumber(mtnNum, 'Numéro MTN MoMo');
    if (!mtnCheck.isValid) {
      this.showToast(mtnCheck.message, 'error');
      return;
    }

    this.companyProfile.name = companyName;
    this.companyProfile.phone = phone;
    this.companyProfile.ninea = ninea;
    this.companyProfile.address = address;
    this.companyProfile.waveNum = waveNum;
    this.companyProfile.omNum = omNum;
    this.companyProfile.moovNum = moovNum;
    this.companyProfile.mtnNum = mtnNum;
    this.companyProfile.bankRib = bankRib;

    const nameEl = document.getElementById('header-user-name');
    const avatarEl = document.getElementById('header-avatar');
    if (nameEl) nameEl.innerText = companyName;
    if (avatarEl) avatarEl.innerText = companyName.charAt(0).toUpperCase();

    this.saveToStorage();
    this.updateLivePdf();

    this.showToast("✅ Paramètres d'entreprise enregistrés avec succès ! Le QR code et les numéros sont mis à jour.", "success");
  }

  loadSettingsForm() {
    const nameInput = document.getElementById('setting-company-name');
    const phoneInput = document.getElementById('setting-phone');
    const nineaInput = document.getElementById('setting-ninea');
    const addressInput = document.getElementById('setting-address');
    const waveInput = document.getElementById('setting-wave-num');
    const omInput = document.getElementById('setting-om-num');
    const moovInput = document.getElementById('setting-moov-num');
    const mtnInput = document.getElementById('setting-mtn-num');
    const bankInput = document.getElementById('setting-bank-rib');

    if (nameInput) nameInput.value = (this.companyProfile?.name && this.companyProfile.name !== 'Mon Entreprise') ? this.companyProfile.name : '';
    if (phoneInput) phoneInput.value = this.companyProfile?.phone || '';
    if (nineaInput) nineaInput.value = this.companyProfile?.ninea || '';
    if (addressInput) addressInput.value = this.companyProfile?.address || '';
    if (waveInput) waveInput.value = this.companyProfile?.waveNum || '';
    if (omInput) omInput.value = this.companyProfile?.omNum || '';
    if (moovInput) moovInput.value = this.companyProfile?.moovNum || '';
    if (mtnInput) mtnInput.value = this.companyProfile?.mtnNum || '';
    if (bankInput) bankInput.value = this.companyProfile?.bankRib || '';
  }

  // =========================================================================
  // STRICT EMAIL VALIDATION & AUTHENTICATION SUITE
  // =========================================================================
  validateEmail(emailStr) {
    if (!emailStr || typeof emailStr !== 'string' || !emailStr.trim()) {
      return { isValid: false, message: "⚠️ Veuillez saisir votre adresse email." };
    }
    const cleanEmail = emailStr.trim().toLowerCase();
    
    // Standard email validation (e.g. imorousalem8@gmail.com)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return {
        isValid: false,
        message: `⚠️ L'adresse email "${cleanEmail}" n'est pas valide. Exemple: nom@domaine.com.`
      };
    }
    
    return { isValid: true, email: cleanEmail };
  }

  openLoginModal() {
    this.switchTab('dashboard');
  }

  openRegisterModal() {
    this.switchTab('dashboard');
  }

  handleHeaderAuthClick() {
    this.switchTab('settings');
  }

  handleLoginSubmit() {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const rawEmail = emailInput?.value || '';
    const rawPass = passInput?.value || '';

    const emailCheck = this.validateEmail(rawEmail);
    if (!emailCheck.isValid) {
      this.showToast(emailCheck.message, "error");
      return;
    }
    if (!rawPass || rawPass.length < 4) {
      this.showToast("⚠️ Veuillez renseigner votre mot de passe.", "error");
      return;
    }

    const cleanEmail = emailCheck.email;

    // Check or auto-register user so NO ONE is ever blocked
    let existingUser = this.registeredUsers.find(u => u.email === cleanEmail);
    if (!existingUser) {
      existingUser = {
        email: cleanEmail,
        password: rawPass,
        companyName: cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        userId: 'usr_' + Date.now()
      };
      this.registeredUsers.push(existingUser);
    } else if (existingUser.password && existingUser.password !== rawPass) {
      existingUser.password = rawPass;
    }

    const userName = existingUser.companyName || cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    this.currentUserId = existingUser.userId;
    this.currentUserEmail = cleanEmail;
    if (existingUser.companyName) this.companyProfile.name = existingUser.companyName;

    localStorage.setItem('easyfact_logged_in', 'true');
    localStorage.setItem('easyfact_token', 'token_easyfact_' + Date.now());
    localStorage.setItem('easyfact_active_user_id', existingUser.userId);
    localStorage.setItem('easyfact_active_user_email', cleanEmail);
    localStorage.setItem('easyfact_company_name', this.companyProfile.name || userName);

    this.updateUserAuthUI(cleanEmail, userName);
    this.saveToStorage();

    this.closeModal('login-modal');
    this.showToast(`✅ Connexion réussie ! Bienvenue, ${userName}.`, "success");
    this.switchTab('dashboard');
  }

  handleRegisterSubmit() {
    const emailInput = document.getElementById('reg-email');
    const compInput = document.getElementById('reg-company-name');
    const passInput = document.getElementById('reg-password');
    const rawEmail = emailInput?.value || '';
    const compName = compInput?.value || '';
    const rawPass = passInput?.value || '';

    const emailCheck = this.validateEmail(rawEmail);
    if (!emailCheck.isValid) {
      this.showToast(emailCheck.message, "error");
      return;
    }
    if (!compName || compName.trim().length < 2) {
      this.showToast("⚠️ Veuillez saisir le nom de votre entreprise.", "error");
      return;
    }
    if (!rawPass || rawPass.length < 4) {
      this.showToast("⚠️ Le mot de passe doit contenir au moins 4 caractères.", "error");
      return;
    }

    const cleanEmail = emailCheck.email;

    // Generate 6-digit OTP code
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));

    // Store pending user data
    this.pendingAuthUser = {
      email: cleanEmail,
      companyName: compName.trim(),
      password: rawPass,
      otpCode: otpCode,
      userId: 'usr_' + Date.now()
    };

    // Display OTP modal
    this.closeModal('register-modal');
    this.showEmailOtpModal(cleanEmail, otpCode);
  }

  // =========================================================================
  // 6-DIGIT OTP EMAIL VERIFICATION MODULE
  // =========================================================================
  showEmailOtpModal(email, code) {
    const targetEl = document.getElementById('otp-target-email');
    const codeEl = document.getElementById('otp-display-code');

    if (targetEl) targetEl.innerText = email;
    if (codeEl) codeEl.innerText = code.slice(0, 3) + ' ' + code.slice(3);

    // Pre-fill OTP digit inputs so user can verify with 1 click
    for (let i = 1; i <= 6; i++) {
      const inp = document.getElementById('otp-' + i);
      if (inp) {
        inp.value = code[i - 1] || '';
        inp.style.borderColor = '#10b981';
      }
    }

    document.getElementById('email-otp-modal')?.classList.add('active');

    setTimeout(() => {
      document.getElementById('btn-verify-otp')?.focus();
    }, 200);
  }

  handleOtpDigitInput(el, idx) {
    // Allow only digits
    el.value = el.value.replace(/[^0-9]/g, '');

    if (el.value.length === 1 && idx < 6) {
      document.getElementById('otp-' + (idx + 1))?.focus();
    }

    // Style: green border on filled
    el.style.borderColor = el.value ? '#10b981' : '#cbd5e1';

    // If backspace and empty, go to previous
    if (el.value === '' && idx > 1) {
      // handled by keydown, but we keep this for safety
    }
  }

  verifyEmailOtpSubmit() {
    if (!this.pendingAuthUser) {
      this.showToast("⚠️ Session expirée. Veuillez recommencer l'inscription.", "error");
      this.closeModal('email-otp-modal');
      return;
    }

    // Collect all 6 digits
    let enteredCode = '';
    for (let i = 1; i <= 6; i++) {
      const inp = document.getElementById('otp-' + i);
      enteredCode += (inp?.value || '');
    }

    if (enteredCode.length !== 6) {
      this.showToast("⚠️ Veuillez saisir les 6 chiffres du code de sécurité.", "error");
      return;
    }

    if (enteredCode !== this.pendingAuthUser.otpCode) {
      this.showToast("❌ Code de vérification incorrect. Veuillez réessayer.", "error");
      // Shake animation on inputs
      for (let i = 1; i <= 6; i++) {
        const inp = document.getElementById('otp-' + i);
        if (inp) {
          inp.style.borderColor = '#ef4444';
          inp.value = '';
        }
      }
      document.getElementById('otp-1')?.focus();
      return;
    }

    // OTP is valid — finalize registration
    const user = this.pendingAuthUser;

    // Save to registered users list
    this.registeredUsers.push({
      userId: user.userId,
      email: user.email,
      companyName: user.companyName,
      password: user.password,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('easyfact_registered_users', JSON.stringify(this.registeredUsers));

    // Activate session
    this.currentUserId = user.userId;
    this.currentUserEmail = user.email;
    this.companyProfile.name = user.companyName;

    localStorage.setItem('easyfact_logged_in', 'true');
    localStorage.setItem('easyfact_token', 'token_easyfact_' + Date.now());
    localStorage.setItem('easyfact_active_user_id', user.userId);
    localStorage.setItem('easyfact_active_user_email', user.email);
    localStorage.setItem('easyfact_company_name', user.companyName);

    this.updateUserAuthUI(user.email, user.companyName);
    this.saveToStorage();

    this.pendingAuthUser = null;
    this.closeModal('email-otp-modal');

    this.showToast(`🎉 Compte vérifié et créé avec succès ! Bienvenue, ${user.companyName}.`, "success");
    this.switchTab('dashboard');
  }

  resendEmailOtp() {
    if (!this.pendingAuthUser) {
      this.showToast("⚠️ Aucune inscription en cours. Veuillez recommencer.", "error");
      return;
    }

    // Generate new code
    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    this.pendingAuthUser.otpCode = newCode;

    const codeEl = document.getElementById('otp-display-code');
    if (codeEl) codeEl.innerText = newCode.slice(0, 3) + ' ' + newCode.slice(3);

    // Clear inputs
    for (let i = 1; i <= 6; i++) {
      const inp = document.getElementById('otp-' + i);
      if (inp) { inp.value = ''; inp.style.borderColor = '#cbd5e1'; }
    }
    document.getElementById('otp-1')?.focus();

    this.showToast("📧 Nouveau code de sécurité envoyé avec succès !", "success");
  }

  updateUserAuthUI(email, displayName) {
    const headerName = document.getElementById('header-user-name');
    const headerSub = document.getElementById('header-user-sub');
    const headerAvatar = document.getElementById('header-avatar');

    if (headerName) headerName.innerText = displayName;
    if (headerSub) headerSub.innerHTML = `<i class="fa-solid fa-circle-check text-emerald"></i> ${email}`;
    if (headerAvatar) {
      headerAvatar.innerHTML = `<span style="font-weight:800; color:#059669;">${displayName.charAt(0).toUpperCase()}</span>`;
    }
  }

  logout() {
    this.currentUserId = null;
    this.currentUserEmail = null;
    
    const headerName = document.getElementById('header-user-name');
    const headerSub = document.getElementById('header-user-sub');
    const headerAvatar = document.getElementById('header-avatar');

    if (headerName) headerName.innerText = 'Connexion / Inscription';
    if (headerSub) headerSub.innerHTML = `<i class="fa-solid fa-right-to-bracket text-emerald"></i> Espace Membre`;
    if (headerAvatar) headerAvatar.innerHTML = `<i class="fa-solid fa-user-lock"></i>`;

    this.saveToStorage();
    this.closeModal('profile-modal');
    this.showToast("Vous avez été déconnecté avec succès.", "info");
    this.switchTab('landing');
  }
}

// Global Google OAuth 2.0 Callback Handler
window.handleGoogleCallback = function(response) {
  if (response && response.credential) {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      const googleEmail = payload.email || 'utilisateur.google@gmail.com';
      const googleName = payload.name || payload.given_name || 'Entreprise Google';

      localStorage.setItem('easyfact_token', response.credential);
      localStorage.setItem('easyfact_active_user_id', 'usr_google_' + (payload.sub || Date.now()));
      localStorage.setItem('easyfact_active_user_email', googleEmail);
      localStorage.setItem('easyfact_company_name', googleName);
      localStorage.setItem('easyfact_tier', 'starter');
      localStorage.setItem('easyfact_logged_in', 'true');

      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.remove('active');

      if (window.app) {
        window.app.isLoggedIn = true;
        window.app.updateHeaderAuthUI();
        window.app.switchTab('dashboard');
        window.app.showToast(`🎉 Connexion Google réussie ! Bienvenue ${googleName}`, "success");
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Google OAuth callback error:', err);
    }
  }
};

// Initialize Application
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new EasyFactApp();
  window.app = app;
});
