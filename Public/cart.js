function guestItems() {
    try {
        const items = JSON.parse(localStorage.getItem('cartItems') || '[]');
        return Array.isArray(items) ? items : [];
    } catch (error) { return []; }
}

let syncing = null;
function syncCart() {
    if (!window.cartLoggedIn || !guestItems().length) return Promise.resolve(false);
    if (syncing) return syncing;
    const items = guestItems();
    syncing = (async () => {
        try {
            const response = await fetch('/cart/sync', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
            if (!response.ok) return false;
            // Remove only items that were sent, retaining products added while the request ran.
            const current = guestItems();
            for (const sent of items) {
                const item = current.find(entry => entry.productId === sent.productId);
                if (item) item.quantity -= sent.quantity;
            }
            const remaining = current.filter(item => item.quantity > 0);
            if (remaining.length) localStorage.setItem('cartItems', JSON.stringify(remaining));
            else localStorage.removeItem('cartItems');
            return true;
        } catch (error) { return false; }
        finally { syncing = null; }
    })();
    return syncing;
}

async function addToCart(productId) {
    if (!window.cartLoggedIn) {
        const items = guestItems();
        const item = items.find(item => item.productId === productId);
        if (item) item.quantity = Math.min(item.quantity + 1, 100);
        else items.push({ productId, quantity: 1 });
        localStorage.setItem('cartItems', JSON.stringify(items));
        alert('Added to cart. Login to view your cart.');
        return;
    }
    await syncCart();
    try {
        const response = await fetch('/cart/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not add product');
        alert('Added to cart');
    } catch (error) { alert(error.message); }
}

async function updateCart(productId, quantity) {
    try {
        const response = await fetch('/cart/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not update cart');
        window.location.reload();
    } catch (error) { alert(error.message); }
}

if (window.cartLoggedIn) {
    syncCart().then(changed => {
        if (changed && window.location.pathname === '/cart') window.location.reload();
        else if (!changed && guestItems().length && window.location.pathname === '/cart') {
            const notice = document.getElementById('cart-sync-error');
            if (notice) notice.textContent = 'Some saved guest items could not be synced. Refresh to retry.';
        }
    });
}
