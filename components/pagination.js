// Pagination Component
// Creates a reusable pagination control

function createPagination(currentPage, totalPages, onPageChange) {
  if (totalPages <= 1) return '';
  
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  const paginationHTML = `
    <div class="pagination" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 2rem;">
      <button 
        class="btn btn-secondary" 
        style="padding: 0.5rem 0.75rem; ${currentPage === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
        onclick="changePage(${currentPage - 1})"
        ${currentPage === 1 ? 'disabled' : ''}
      >
        ‹ Prev
      </button>
      
      ${startPage > 1 ? `
        <button class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" onclick="changePage(1)">1</button>
        ${startPage > 2 ? '<span style="color: #94a3b8;">...</span>' : ''}
      ` : ''}
      
      ${pages.map(page => `
        <button 
          class="btn ${page === currentPage ? 'btn-primary' : 'btn-secondary'}" 
          style="padding: 0.5rem 0.75rem;"
          onclick="changePage(${page})"
        >
          ${page}
        </button>
      `).join('')}
      
      ${endPage < totalPages ? `
        ${endPage < totalPages - 1 ? '<span style="color: #94a3b8;">...</span>' : ''}
        <button class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" onclick="changePage(${totalPages})">${totalPages}</button>
      ` : ''}
      
      <button 
        class="btn btn-secondary" 
        style="padding: 0.5rem 0.75rem; ${currentPage === totalPages ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
        onclick="changePage(${currentPage + 1})"
        ${currentPage === totalPages ? 'disabled' : ''}
      >
        Next ›
      </button>
    </div>
    
    <div style="text-align: center; margin-top: 1rem; color: #94a3b8; font-size: 0.875rem;">
      Page ${currentPage} of ${totalPages}
    </div>
  `;
  
  return paginationHTML;
}
