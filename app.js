// 1. Configuración de Supabase
const SUPABASE_URL = 'https://cqmbptsgzfevsvlcvugh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWJwdHNnemZldnN2bGN2dWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODk3MTUsImV4cCI6MjA2MjY2NTcxNX0.cSz4Rz1h2AhaLBXJmbaYL62zsR-EIWbiRSykF0UQI64';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE_NAME = 'compras';

// 2. Variables de elementos del DOM (compatibles con ambas nomenclaturas de ID)
let addForm, itemInput, categorySelect, searchInput;
let shoppingListEl, fridgeListEl, shoppingCountEl, fridgeCountEl;
let toastEl, quickChips, filterBtns;

// Estado local
let items = [];
let currentFilter = 'all'; // 'all' | 'Nevera' | 'Despensa' | 'Aseo'

// 3. Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Buscar elementos aceptando ambos IDs
    addForm = document.getElementById('add-form') || document.getElementById('add-item-form');
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

// 4. Cargar productos desde Supabase
async function fetchItems() {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        showToast('Error cargando: ' + error.message, 'error');
        console.error('Error al cargar:', error);
        return;
    }

    items = data || [];
    renderItems();
}

// 5. Suscripción en tiempo real
function setupRealtimeSubscription() {
    supabase
        .channel('custom-all-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => {
            fetchItems();
        })
        .subscribe();
}

// 6. Renderizar listas y aplicar filtros
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

// 7. Generar HTML de cada elemento
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

// 8. Event Listeners
function setupEventListeners() {
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemInput ? itemInput.value.trim() : '';
            const category = categorySelect ? categorySelect.value : 'Nevera';

            if (!name) return;

            const newRecord = {
                name: name,
                category: category,
                in_fridge: false
            };

            const { error } = await supabase
                .from(TABLE_NAME)
                .insert([newRecord]);

            if (error) {
                showToast('Error al guardar: ' + error.message, 'error');
                console.error(error);
            } else {
                if (itemInput) itemInput.value = '';
                showToast('Producto añadido 🛒', 'success');
            }
        });
    }

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

// 9. Cambiar estado (Por comprar <-> En casa)
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
    }
};

// 10. Eliminar producto
window.deleteItem = async (id) => {
    const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

    if (error) {
        showToast('Error al eliminar: ' + error.message, 'error');
    } else {
        showToast('Producto eliminado', 'info');
    }
};

// 11. Toast de notificación
function showToast(message, type = 'info') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    setTimeout(() => {
        toastEl.className = 'toast hidden';
    }, 3500);
}

// 12. Sanitizar texto
function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}