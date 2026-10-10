// 1. CREDENCIALES DE SUPABASE: COLOCA AQUÍ TUS CREDENCIALES REALES
const SUPABASE_URL = 'https://cqmbptsgzfevsvlcvugh.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWJwdHNnemZldnN2bGN2dWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODk3MTUsImV4cCI6MjEwMjY2NTcxNX0.cSz4Rz1h2AhaLBXJmbaYL62zsR-EIWbiRSykF0UQI64';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Nombre de la tabla en Supabase (si tu tabla es 'compras', déjalo en 'compras')
const TABLE_NAME = 'compras';

// Elementos del DOM
const addForm = document.getElementById('add-form');
const itemInput = document.getElementById('item-input');
const categorySelect = document.getElementById('category-select');
const searchInput = document.getElementById('search-input');
const shoppingListEl = document.getElementById('shopping-list');
const fridgeListEl = document.getElementById('fridge-list');
const shoppingCountEl = document.getElementById('shopping-count');
const fridgeCountEl = document.getElementById('fridge-count');
const toastEl = document.getElementById('toast');
const quickChips = document.querySelectorAll('.chip');
const filterBtns = document.querySelectorAll('.filter-btn');

// Estado local
let items = [];
let currentFilter = 'all'; // 'all' | 'Nevera' | 'Despensa' | 'Aseo'

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    fetchItems();
    setupRealtimeSubscription();
    setupEventListeners();
});

// Cargar productos
async function fetchItems() {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        showToast('Error al cargar datos: ' + error.message, 'error');
        console.error('Error al cargar:', error);
        return;
    }

    items = data || [];
    renderItems();
}

// Sincronización en tiempo real
function setupRealtimeSubscription() {
    supabase
        .channel('custom-all-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => {
            fetchItems();
        })
        .subscribe();
}

// Renderizado con filtros
function renderItems() {
    const query = searchInput.value.toLowerCase().trim();
    
    const filteredItems = items.filter(item => {
        const name = (item.name || item.nombre || '').toLowerCase();
        const category = (item.category || item.categoria || '');

        const matchesQuery = name.includes(query) || category.toLowerCase().includes(query);
        const matchesFilter = currentFilter === 'all' || category.toLowerCase() === currentFilter.toLowerCase();

        return matchesQuery && matchesFilter;
    });

    const shoppingItems = filteredItems.filter(item => !item.in_fridge);
    const fridgeItems = filteredItems.filter(item => item.in_fridge);

    shoppingCountEl.textContent = shoppingItems.length;
    fridgeCountEl.textContent = fridgeItems.length;

    shoppingListEl.innerHTML = shoppingItems.map(item => createItemHTML(item)).join('');
    fridgeListEl.innerHTML = fridgeItems.map(item => createItemHTML(item)).join('');
}

// Plantilla HTML de cada producto
function createItemHTML(item) {
    const name = escapeHTML(item.name || item.nombre || '');
    const category = escapeHTML(item.category || item.categoria || 'Nevera');
    const isFridge = !!item.in_fridge;
    const catClass = category.toLowerCase();

    const categoryIcon = catClass === 'despensa' ? '🥫 Despensa' :
                         catClass === 'aseo' ? '🧹 Aseo' : '❄️ Nevera';

    return `
        <li class="item ${isFridge ? 'in-fridge' : ''}" data-id="${item.id}">
            <label class="checkbox-container">
                <input type="checkbox" ${isFridge ? 'checked' : ''} onchange="toggleStatus('${item.id}', ${isFridge})">
                <span class="checkmark"></span>
            </label>
            <div class="item-details">
                <span class="item-name">${name}</span>
                <div class="item-tags">
                    <span class="item-category-tag ${catClass}">${categoryIcon}</span>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteItem('${item.id}')" title="Eliminar">🗑️</button>
        </li>
    `;
}

// Añadir producto
addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = itemInput.value.trim();
    const category = categorySelect.value;

    if (!name) return;

    // Compatible tanto si tus columnas en Supabase se llaman en inglés (name, category) como en español (nombre, categoria)
    const newRecord = {
        name: name,
        category: category,
        in_fridge: false
    };

    const { error } = await supabase
        .from(TABLE_NAME)
        .insert([newRecord]);

    if (error) {
        // Muestra en el toast la razón exacta devuelta por Supabase
        showToast('Error: ' + error.message, 'error');
        console.error('Error insertando:', error);
    } else {
        itemInput.value = '';
        showToast('Producto añadido 🛒', 'success');
    }
});

// Cambiar estado (Por comprar <-> En casa)
window.toggleStatus = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    
    if (newStatus) {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        }
        showToast('¡Guardado en casa! ✨', 'success');
    } else {
        showToast('Movido a compras 🛒', 'info');
    }

    const { error } = await supabase
        .from(TABLE_NAME)
        .update({ in_fridge: newStatus })
        .eq('id', id);

    if (error) {
        showToast('Error: ' + error.message, 'error');
        console.error('Error actualizando:', error);
    }
};

// Eliminar producto
window.deleteItem = async (id) => {
    const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

    if (error) {
        showToast('Error al eliminar: ' + error.message, 'error');
        console.error('Error eliminando:', error);
    } else {
        showToast('Producto eliminado', 'info');
    }
};

// Event Listeners
function setupEventListeners() {
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            itemInput.value = chip.dataset.name;
            if (chip.dataset.category) {
                categorySelect.value = chip.dataset.category;
            }
            itemInput.focus();
        });
    });

    searchInput.addEventListener('input', renderItems);

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderItems();
        });
    });
}

// Notificaciones flotantes
function showToast(message, type = 'info') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    setTimeout(() => {
        toastEl.className = 'toast hidden';
    }, 3500);
}

// Sanitizar HTML
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
