// Helper script to document the pattern for fixing pages
// Each page needs:
// 1. i18n.js script (already added)
// 2. Wrap initialization in async initPage()
// 3. await waitForI18n()
// 4. Use t() in createHeader()
// 5. Call initializeLanguageSwitcher()

const pagesConfig = {
  'customers.html': { title: 'customers.title', subtitle: 'customers.customer_details' },
  'customers-new.html': { title: 'customers.add_customer', subtitle: 'customers.create_new_customer' },
  'customers-edit.html': { title: 'customers.edit_customer', subtitle: 'customers.update_customer_info' },
  'customers-view.html': { title: 'customers.customer_details', subtitle: 'customers.view_customer_info' },
  'loans.html': { title: 'loans.title', subtitle: 'loans.loan_details' },
  'loans-new.html': { title: 'loans.add_loan', subtitle: 'loans.create_new_loan' },
  'loans-edit.html': { title: 'loans.edit_loan', subtitle: 'loans.update_loan_info' },
  'loans-view.html': { title: 'loans.loan_details', subtitle: 'loans.view_loan_info' },
  'installments.html': { title: 'installments.title', subtitle: 'installments.payment_history' },
  'installments-view.html': { title: 'installments.installment_details', subtitle: 'installments.view_installment_info' },
  'products.html': { title: 'products.title', subtitle: 'products.product_details' },
  'products-new.html': { title: 'products.add_product', subtitle: 'products.create_new_product' },
  'products-edit.html': { title: 'products.edit_product', subtitle: 'products.update_product_info' },
  'institutions.html': { title: 'institutions.title', subtitle: 'institutions.institution_details' },
  'institutions-new.html': { title: 'institutions.add_institution', subtitle: 'institutions.create_new_institution' },
  'institutions-edit.html': { title: 'institutions.edit_institution', subtitle: 'institutions.update_institution_info' },
  'institutions-view.html': { title: 'institutions.institution_details', subtitle: 'institutions.view_institution_info' },
  'branches-new.html': { title: 'branches.add_branch', subtitle: 'branches.create_new_branch' },
  'branches-edit.html': { title: 'branches.edit_branch', subtitle: 'branches.update_branch_info' },
  'branches-view.html': { title: 'branches.branch_details', subtitle: 'branches.view_branch_info' },
  'users.html': { title: 'users.title', subtitle: 'users.user_details' },
  'users-new.html': { title: 'users.add_user', subtitle: 'users.create_new_user' },
  'users-edit.html': { title: 'users.edit_user', subtitle: 'users.update_user_info' },
  'search-logs.html': { title: 'search_logs.title', subtitle: 'search_logs.search_history' }
};
