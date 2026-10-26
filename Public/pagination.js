const loadMore = document.getElementById('load-more');
if (loadMore) {
    loadMore.addEventListener('click', async () => {
        const cursor = loadMore.dataset.cursor;
        if (!cursor || loadMore.disabled) return;
        loadMore.disabled = true;
        loadMore.textContent = 'Loading...';
        document.getElementById('load-error').textContent = '';
        try {
            const response = await fetch('/products/more?cursor=' + encodeURIComponent(cursor));
            if (!response.ok) throw new Error('Request failed');
            const page = await response.json();
            document.getElementById('products-grid').insertAdjacentHTML('beforeend', page.html);
            loadMore.dataset.cursor = page.nextCursor || '';
            if (!page.nextCursor) loadMore.classList.add('hidden');
        } catch (error) {
            document.getElementById('load-error').textContent = 'Could not load products. Check your server connection.';
        } finally {
            loadMore.disabled = false;
            loadMore.textContent = 'Load More';
        }
    });
}
