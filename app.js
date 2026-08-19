// Configuración de Supabase
const SUPABASE_URL = 'https://cqmbptsgzfevsvlcvugh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWJwdHNnemZldnN2bGN2dWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODk3MTUsImV4cCI6MjEwMjY2NTcxNX0.cSz4Rz1h2AhaLBXJmbaYL62zsR-EIWbiRSykF0UQI64';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos del DOM
const form = document.getElementById('item-form');
const input = document.getElementById('item-input');
const qtyInput = document.getElementById('quantity-input');
const categorySelect = document.getElementById('category-select');
const itemsList = document.getElementById('items-list');
const completedList = document.getElementById('completed-list');
const pendingCount = document.getElementById('pending-count');
const completedCount = document.getElementById('completed-count');
const btnWhatsapp = document.getElementById('btn-whatsapp');
const btnClearDone = document.getElementById('btn-clear-done');
const quickButtons = document.querySelectorAll('.btn-quick');

let itemsState = [];

//Cargar items
async function fetchItems() {
  const { data, error } = await supabaseClient
    .from('compras')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al cargar datos:', error);
    return;
  }

  itemsState = data || [];
  render();
}

// Renderizar listas
function render() {
  itemsList.innerHTML = '';
  completedList.innerHTML = '';

  const pending = itemsState.filter(item => !item.comprado);
  const completed = itemsState.filter(item => item.comprado);

  pendingCount.textContent = pending.length;
  completedCount.textContent = completed.length;

  pending.forEach(item => itemsList.appendChild(createItemElement(item)));
  completed.forEach(item => completedList.appendChild(createItemElement(item)));
}

function createItemElement(item) {
  const li = document.createElement('li');
  li.className = 'item-card';

  const qtyBadge = item.cantidad ? `<span class="item-qty-badge">${item.cantidad}</span>` : '';

  li.innerHTML = `
    <div class="item-left">
      <input type="checkbox" class="item-checkbox" ${item.comprado ? 'checked' : ''}>
      <div class="item-info">
        <span class="item-title">${item.nombre} ${qtyBadge}</span>
        <span class="item-badge">${item.categoria}</span>
      </div>
    </div>
    <button class="btn-delete" title="Eliminar">✕</button>
  `;

  // Checkbox interactivo
  const checkbox = li.querySelector('.item-checkbox');
  checkbox.addEventListener('change', async () => {
    await toggleItem(item.id, !item.comprado);
  });

  // Eliminar
  const deleteBtn = li.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', async () => {
    await deleteItem(item.id);
  });

  return li;
}

//Acciones en la base de datos
async function addItem(nombre, categoria, cantidad = '') {
  if (!nombre.trim()) return;

  const { error } = await supabaseClient
    .from('compras')
    .insert([{ 
      nombre: nombre.trim(), 
      categoria: categoria, 
      cantidad: cantidad.trim(), 
      comprado: false 
    }]);

  if (error) {
    console.error('Error al agregar:', error);
  } else {
    await fetchItems();
  }
}

async function toggleItem(id, status) {
  const { error } = await supabaseClient
    .from('compras')
    .update({ comprado: status })
    .eq('id', id);

  if (error) console.error('Error al actualizar:', error);
  else await fetchItems();
}

async function deleteItem(id) {
  const { error } = await supabaseClient
    .from('compras')
    .delete()
    .eq('id', id);

  if (error) console.error('Error al borrar:', error);
  else await fetchItems();
}

// 4. Event Listeners
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await addItem(input.value, categorySelect.value, qtyInput.value);
  input.value = '';
  qtyInput.value = '';
  input.focus();
});

// Botones rápidos
quickButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const item = btn.getAttribute('data-item');
    const cat = btn.getAttribute('data-cat');
    await addItem(item, cat, '');
  });
});

// Borrar completados
btnClearDone.addEventListener('click', async () => {
  const confirmClear = confirm('¿Eliminar todos los productos comprados de la lista?');
  if (!confirmClear) return;

  const { error } = await supabaseClient
    .from('compras')
    .delete()
    .eq('comprado', true);

  if (error) console.error('Error al limpiar comprados:', error);
  else await fetchItems();
});

// Enviar a WhatsApp (con cantidad formateada)
btnWhatsapp.addEventListener('click', () => {
  const pending = itemsState.filter(item => !item.comprado);
  if (pending.length === 0) {
    alert('No hay productos pendientes en la lista.');
    return;
  }

  let text = '🛒 *LISTA DE COMPRAS - CASA*\n\n';
  pending.forEach(item => {
    const qtyText = item.cantidad ? ` [${item.cantidad}]` : '';
    text += `• ${item.nombre}${qtyText} _(${item.categoria})_\n`;
  });

  const url = `https://wa.me/?text=${encodeURI(text)}`;
  window.open(url, '_blank');
});

// Carga inicial
fetchItems();