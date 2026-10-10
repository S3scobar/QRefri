// 1. Credenciales limpias (sin /rest/v1/ al final)
const SUPABASE_URL = 'https://cqmbptsgzfevsvlcvugh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWJwdHNnemZldnN2bGN2dWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODk3MTUsImV4cCI6MjA2MjY2NTcxNX0.cSz4Rz1h2AhaLBXJmbaYL62zsR-EIWbiRSykF0UQI64';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE_NAME = 'compras';

// Variables
let itemInput, categorySelect, searchInput;
let shoppingListEl, fridgeListEl, shoppingCountEl, fridgeCountEl;
let toastEl, quickChips, filterBtns;

let items = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    itemInput = document.getElementById('item-input') || document.getElementById('item-name');
    categorySelect = document.getElementById('category-select') || document.getElementById('item-category');
    searchInput = document.getElementById('search-input') || document.getElementById('search-items');
    
    shoppingListEl = document.getElementById('shopping-list') || document.getElementById('shopping-items');
    fridgeListEl = document.getElementById('fridge-list') || document.getElementById('fridge-items');
    shoppingCountEl = document.getElementById('shopping-count') || document.getElementById('shopping-counter');
    fridgeCountEl = document.getElementById('fridge-count') || document.getElementById('fridge-counter');
    
    toastEl = document.getElementById('toast');
    quickChips = document.querySelectorAll('.chip');
    filterBtns = document.querySelectorAll('.filter-btn');

    setupEventListeners();
    fetchItems();
    setupRealtimeSubscription();
});

// Cargar productos
async function fetchItems() {
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error al cargar:', error);
            return;
        }

        items = data || [];
        renderItems();
    } catch (err) {
        console.error('Error de conexión:', err);
    }
}

// Sincronización en tiempo real
function setupRealtimeSubscription() {
    supabase
        .channel('compras-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => {
            fetchItems();
        })
        .subscribe();
}

// Renderizar elementos
function renderItems() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredItems = items.filter(item => {
        const name = (item.name || item.nombre || '').toLowerCase();
        const category = (item.category || item.categoria || '');

        const matchesQuery = name.includes(query) || category.toLowerCase().includes(query);
        const matchesFilter = currentFilter === 'all' || category.toLowerCase() === currentFilter.toLowerCase();

        return matchesQuery && matchesFilter;
    });

    const shoppingItems = filteredItems.filter(item => !item.in_fridge);
    const fridgeItems = filteredItems.filter(item => item.in_fridge);

    if (shoppingCountEl) shoppingCountEl.textContent = shoppingItems.length;
    if (fridgeCountEl) fridgeCountEl.textContent = fridgeItems.length;

    if (shoppingListEl) {
        shoppingListEl.innerHTML = shoppingItems.map(item => createItemHTML(item)).join('');
    }
    if (fridgeListEl) {
        fridgeListEl.innerHTML = fridgeItems.map(item => createItemHTML(item)).join('');
    }
}

// Plantilla de ítem
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

// Función directa para agregar
window.agregarProducto = async function() {
    if (!itemInput) {
        itemInput = document.getElementById('item-input') || document.getElementById('item-name');
    }
    if (!categorySelect) {
        categorySelect = document.getElementById('category-select') || document.getElementById('item-category');
    }

    const name = itemInput ? itemInput.value.trim() : '';
    const category = categorySelect ? categorySelect.value : 'Nevera';

    if (!name) {
        alert('Escribe el nombre del producto primero');
        return;
    }

    // Insertar en Supabase
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert([{ name: name, category: category, in_fridge: false }])
        .select();

    if (error) {
        alert('Error al guardar en Supabase: ' + error.message);
        console.error(error);
    } else {
        if (itemInput) itemInput.value = '';
        showToast('Producto añadido 🛒', 'success');
        await fetchItems();
    }
};

// Event Listeners adicionales
function setupEventListeners() {
    if (quickChips) {
        quickChips.forEach(chip => {
            chip.addEventListener('click', () => {
                if (itemInput) {
                    itemInput.value = chip.dataset.name;
                    itemInput.focus();
                }
                if (categorySelect && chip.dataset.category) {
                    categorySelect.value = chip.dataset.category;
                }
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderItems);
    }

    if (filterBtns) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderItems();
            });
        });
    }
}

// Cambiar estado
window.toggleStatus = async (id, currentStatus) => {
    const newStatus = !currentStatus;

    const target = items.find(i => String(i.id) === String(id));
    if (target) {
        target.in_fridge = newStatus;
        renderItems();
    }
    
    if (newStatus && typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }

    const { error } = await supabase
        .from(TABLE_NAME)
        .update({ in_fridge: newStatus })
        .eq('id', id);

    if (error) {
        alert('Error en Supabase: ' + error.message);
        await fetchItems();
    }
};

// Eliminar
window.deleteItem = async (id) => {
    items = items.filter(i => String(i.id) !== String(id));
    renderItems();

    const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

    if (error) {
        alert('Error en Supabase: ' + error.message);
        await fetchItems();
    }
};

// Toast
function showToast(message, type = 'info') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    setTimeout(() => {
        toastEl.className = 'toast hidden';
    }, 3000);
}

// Sanitizar
function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}