# Batch fix all remaining pages with i18n initialization

$pages = @{
    'customers-new.html' = @('customers.add_customer', 'customers.create_new_customer')
    'customers-edit.html' = @('customers.edit_customer', 'customers.update_customer_info')
    'customers-view.html' = @('customers.customer_details', 'customers.view_customer_info')
    'loans-new.html' = @('loans.add_loan', 'loans.create_new_loan')
    'loans-edit.html' = @('loans.edit_loan', 'loans.update_loan_info')
    'loans-view.html' = @('loans.loan_details', 'loans.view_loan_info')
    'branches-new.html' = @('branches.add_branch', 'branches.create_new_branch')
    'branches-edit.html' = @('branches.edit_branch', 'branches.update_branch_info')
    'branches-view.html' = @('branches.branch_details', 'branches.view_branch_info')
    'institutions-new.html' = @('institutions.add_institution', 'institutions.create_new_institution')
    'institutions-edit.html' = @('institutions.edit_institution', 'institutions.update_institution_info')
    'institutions-view.html' = @('institutions.institution_details', 'institutions.view_institution_info')
    'products-new.html' = @('products.add_product', 'products.create_new_product')
    'products-edit.html' = @('products.edit_product', 'products.update_product_info')
    'users-new.html' = @('users.add_user', 'users.create_new_user')
    'users-edit.html' = @('users.edit_user', 'users.update_user_info')
    'installments-view.html' = @('installments.installment_details', 'installments.view_installment_info')
    'search-logs.html' = @('search_logs.title', 'search_logs.search_history')
}

Write-Host "Pages to fix: $($pages.Count)" -ForegroundColor Green
