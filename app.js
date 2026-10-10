// 1. Configuración de Supabase
const SUPABASE_URL = 'https://cqmbptsgzfevsvlcvugh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWJwdHNnemZldnN2bGN2dWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODk3MTUsImV4cCI6MjA2MjY2NTcxNX0.cSz4Rz1h2AhaLBXJmbaYL62zsR-EIWbiRSykF0UQI64';

// Usamos 'db' para evitar colisión de nombres con la variable global de Supabase
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE_NAME = 'compras';

// Variables de elementos DOM
let itemInput, categorySelect, searchInput, submitBtn;
let shoppingListEl, fridgeListEl, shoppingCountEl, fridgeCountEl;
let toastEl, quickChips, filterBtns;

let items = [];
let currentFilter = 'all';

// Inicializar cuando el DOM cargue
document.addEventListener('DOMContentLoaded', () => {
    itemInput = document.getElementById('item-input');
    categorySelect = document.getElementById('category-select');
    submitBtn = document.getElementById('submit-btn');
    searchInput = document.getElementById('search-input');
    
    shoppingListEl = document.getElementById('shopping-list');
    fridgeListEl = document.getElementById('fridge-list');
    shoppingCountEl = document.getElementById('shopping-count');
    fridgeCountEl = document.getElementById('fridge-count');
    
    toastEl = document.getElementById('toast');
    quickChips = document.querySelectorAll('.chip');
    filterBtns = document.querySelectorAll('.filter-btn');

    setupEventListeners();
    fetchItems();
    setupRealtimeSubscription();
});

// Cargar productos desde Supabase
async function fetchItems() {
    try {
        const { data, error } = await db
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
    db.channel('compras-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => {
          fetchItems();
      })
      .subscribe();
}

// Renderizar elementos y aplicar filtros
function renderItems() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredItems = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        const category = (item.category || '');

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

// Plantilla de cada ítem
function createItemHTML(item) {
    const name = escapeHTML(item.name || '');
    const category = escapeHTML(item.category || 'Nevera');
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

// Función para añadir productos
window.agregarProducto = async function(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!itemInput) itemInput = document.getElementById('item-input');
    if (!categorySelect) categorySelect = document.getElementById('category-select');
    if (!submitBtn) submitBtn = document.getElementById('submit-btn');

    const name = itemInput ? itemInput.value.trim() : '';
    const category = categorySelect ? categorySelect.value : 'Nevera';

    if (!name) {
        alert('Por favor escribe el nombre de un producto');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
    }

    try {
        const { data, error } = await db
            .from(TABLE_NAME)
            .insert([{ name: name, category: category, in_fridge: false }])
            .select();

        if (error) {
            alert('Error devuelto por Supabase: ' + error.message);
            console.error('Error insertando:', error);
        } else {
            if (itemInput) itemInput.value = '';
            showToast('Producto añadido 🛒', 'success');
            await fetchItems();
        }
    } catch (err) {
        alert('Error inesperado: ' + err.message);
        console.error(err);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Añadir a la Lista';
        }
    }
};

// Event Listeners (Buscador, Chips y Filtros)
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

// Cambiar estado (Por comprar <-> En casa)
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

    const { error } = await db
        .from(TABLE_NAME)
        .update({ in_fridge: newStatus })
        .eq('id', id);

    if (error) {
        alert('Error actualizando: ' + error.message);
        await fetchItems();
    }
};

// Eliminar producto
window.deleteItem = async (id) => {
    items = items.filter(i => String(i.id) !== String(id));
    renderItems();

    const { error } = await db
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

    if (error) {
        alert('Error eliminando: ' + error.message);
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
