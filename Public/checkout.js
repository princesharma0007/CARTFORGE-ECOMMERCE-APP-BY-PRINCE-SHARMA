const form = document.getElementById('address-form');
const errorBox = document.getElementById('checkout-error');
function showError(message) { errorBox.textContent = message; }
async function postJSON(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
form.addEventListener('submit', async e => {
  e.preventDefault(); showError('');
  const body = Object.fromEntries(new FormData(form).entries());
  try { await postJSON('/checkout/address', body); location.reload(); }
  catch (err) { showError(err.message); }
});
function editAddress(address) {
  for (const [key, value] of Object.entries(address)) {
    const input = form.elements[key]; if (input && input.type === 'checkbox') input.checked = Boolean(value);
    else if (input) input.value = value;
  }
  form.elements.addressId.value = address.id;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function deleteAddress(id) {
  if (!confirm('Delete this address?')) return;
  try { await postJSON('/checkout/address/' + encodeURIComponent(id) + '/delete', {}); location.reload(); }
  catch (err) { showError(err.message); }
}
document.getElementById('pay-button').addEventListener('click', async () => {
  const button = document.getElementById('pay-button');
  const selected = document.querySelector('input[name="address"]:checked');
  if (!selected) return showError('Save and select a delivery address first.');
  if (typeof Razorpay === 'undefined') return showError('Razorpay could not load. Check your connection.');
  button.disabled = true; showError('');
  try {
    const order = await postJSON('/checkout/create-order', { addressId: selected.value });
    const rzp = new Razorpay({
      key: order.key, amount: order.amount, currency: order.currency, order_id: order.orderId,
      name: 'CARTFORGE', description: 'Shopping cart payment',
      prefill: { name: order.name, email: order.email, contact: order.phone },
      theme: { color: '#111827' },
      handler: async response => {
        try {
          showError('Verifying payment...');
         await postJSON('/checkout/verify-payment', response);
          location.href = '/orders';
        } catch (err) { showError(err.message + ' Your payment may have been captured; check Orders before paying again.'); button.disabled = false; }
      },
      modal: { ondismiss: () => { button.disabled = false; } }
    });
    rzp.on('payment.failed', event => { showError(event.error.description || 'Payment failed'); button.disabled = false; });
    rzp.open();
  } catch (err) { showError(err.message); button.disabled = false; }
});
