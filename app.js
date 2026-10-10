// Configuración de Supabase (coloca tus credenciales reales aquí)
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_KEY = 'TU-ANON-KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Elementos del DOM
const addForm = document.getElementById('add-form');
const itemInput = document.getElementById('item-input');
const categorySelect = document.getElementById('category-select');
const storageSelect = document.getElementById('storage-select');
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
let currentFilter = 'all'; // 'all' | 'nevera' | 'despensa'

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    fetchItems();
    setupRealtimeSubscription();
    setupEventListeners();
});

// Obtener registros de la tabla 'compras'
async function fetchItems() {
    const { data, error } = await supabase
        .from('compras')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        showToast('Error al cargar la lista', 'error');
        console.error(error);
        return;
    }

    items = data || [];
    renderItems();
}

// Sincronización en tiempo real vía WebSockets
function setupRealtimeSubscription() {
    supabase
        .channel('custom-all-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, () => {
            fetchItems();
        })
        .subscribe();
}

// Renderizar listas con filtros (búsqueda y Nevera/Despensa)
function renderItems() {
    const query = searchInput.value.toLowerCase().trim();
    
    const filteredItems = items.filter(item => {
        const name = (item.name || item.nombre || '').toLowerCase();
        const category = (item.category || item.categoria || '').toLowerCase();
        const matchesQuery = name.includes(query) || category.includes(query);

        const storage = item.storage_type || 'nevera';
        const matchesFilter = currentFilter === 'all' || storage === currentFilter;

        return matchesQuery && matchesFilter;
    });

    const shoppingItems = filteredItems.filter(item => !item.in_fridge);
    const fridgeItems = filteredItems.filter(item => item.in_fridge);

    shoppingCountEl.textContent = shoppingItems.length;
    fridgeCountEl.textContent = fridgeItems.length;

    shoppingListEl.innerHTML = shoppingItems.map(item => createItemHTML(item)).join('');
    fridgeListEl.innerHTML = fridgeItems.map(item => createItemHTML(item)).join('');
}

// Generar el HTML de cada producto
function createItemHTML(item) {
    const name = escapeHTML(item.name || item.nombre || '');
    const category = escapeHTML(item.category || item.categoria || '');
    const isFridge = !!item.in_fridge;
    const storageType = item.storage_type || 'nevera';
    const storageBadge = storageType === 'despensa' ? '🥫 Despensa' : '❄️ Nevera';

    return `
        <li class="item ${isFridge ? 'in-fridge' : ''}" data-id="${item.id}">
            <label class="checkbox-container">
                <input type="checkbox" ${isFridge ? 'checked' : ''} onchange="toggleStatus('${item.id}', ${isFridge})">
                <span class="checkmark"></span>
            </label>
            <div class="item-details">
                <span class="item-name">${name}</span>
                <div class="item-tags">
                    <span class="item-category">${category}</span>
                    <span class="item-storage-tag ${storageType}">${storageBadge}</span>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteItem('${item.id}')" title="Eliminar">🗑️</button>
        </li>
    `;
}

// Añadir nuevo producto a 'compras'
addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = itemInput.value.trim();
    const category = categorySelect.value;
    const storage_type = storageSelect.value;

    if (!name) return;

    // Compatible si tu columna se llama 'name' o 'nombre'
    const newRecord = {
        name: name,
        category: category,
        storage_type: storage_type,
        in_fridge: false
    };

    const { error } = await supabase
        .from('compras')
        .insert([newRecord]);

    if (error) {
        showToast('Error al guardar el producto', 'error');
        console.error(error);
    } else {
        itemInput.value = '';
        showToast('Producto añadido a la lista 🛒', 'success');
    }
});

// Cambiar estado (Mover entre "Por comprar" y "En casa")
window.toggleStatus = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    
    if (newStatus) {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        }
        showToast('¡Guardado en casa! ✨', 'success');
    } else {
        showToast('Movido a lista de compras 🛒', 'info');
    }

    const { error } = await supabase
        .from('compras')
        .update({ in_fridge: newStatus })
        .eq('id', id);

    if (error) {
        showToast('Error al actualizar el estado', 'error');
        console.error(error);
    }
};

// Eliminar producto
window.deleteItem = async (id) => {
    const { error } = await supabase
        .from('compras')
        .delete()
        .eq('id', id);

    if (error) {
        showToast('Error al eliminar', 'error');
        console.error(error);
    } else {
        showToast('Producto eliminado', 'info');
    }
};

// Event Listeners (Buscador, Chips y Filtros)
function setupEventListeners() {
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            itemInput.value = chip.dataset.name;
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

// Notificación Toast
function showToast(message, type = 'info') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    setTimeout(() => {
        toastEl.className = 'toast hidden';
    }, 3000);
}

// Sanitizar entradas de texto
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
