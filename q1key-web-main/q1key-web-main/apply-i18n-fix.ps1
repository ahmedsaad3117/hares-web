# PowerShell script to add async i18n initialization to all pages
param()

$basePath = "c:\Users\ahmed\hares\web\pages"

$pages = @(
    @{file='customers-edit.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Edit Customer', 'Update customer information')"; newHeader="createHeader(t('customers.edit_customer'), t('customers.update_customer_info'))"},
    @{file='customers-view.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Customer Details', 'View customer profile')"; newHeader="createHeader(t('customers.customer_details'), t('customers.view_customer_info'))"},
    @{file='loans-new.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('New Loan', 'Create a new loan application')"; newHeader="createHeader(t('loans.add_loan'), t('loans.create_new_loan'))"},
    @{file='loans-edit.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Edit Loan', 'Update loan information')"; newHeader="createHeader(t('loans.edit_loan'), t('loans.update_loan_info'))"},
    @{file='loans-view.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Loan Details', 'View loan information')"; newHeader="createHeader(t('loans.loan_details'), t('loans.view_loan_info'))"},
    @{file='branches-new.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Add Branch', 'Create a new branch location')"; newHeader="createHeader(t('branches.add_branch'), t('branches.create_new_branch'))"},
    @{file='branches-edit.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Edit Branch', 'Update branch information')"; newHeader="createHeader(t('branches.edit_branch'), t('branches.update_branch_info'))"},
    @{file='branches-view.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Branch Details', 'View branch information')"; newHeader="createHeader(t('branches.branch_details'), t('branches.view_branch_info'))"},
    @{file='institutions-new.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Add Institution', 'Create a new financial institution')"; newHeader="createHeader(t('institutions.add_institution'), t('institutions.create_new_institution'))"},
    @{file='institutions-edit.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Edit Institution', 'Update institution information')"; newHeader="createHeader(t('institutions.edit_institution'), t('institutions.update_institution_info'))"},
    @{file='institutions-view.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Institution Details', 'View institution information')"; newHeader="createHeader(t('institutions.institution_details'), t('institutions.view_institution_info'))"},
    @{file='products-new.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Add Product', 'Create a new loan product')"; newHeader="createHeader(t('products.add_product'), t('products.create_new_product'))"},
    @{file='products-edit.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Edit Product', 'Update product information')"; newHeader="createHeader(t('products.edit_product'), t('products.update_product_info'))"},
    @{file='users-new.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Add User', 'Create a new system user')"; newHeader="createHeader(t('users.add_user'), t('users.create_new_user'))"},
    @{file='users-edit.html'; pattern='createHeader\([^)]+\)'; oldHeader="createHeader('Edit User', 'Update user information')"; newHeader="createHeader(t('users.edit_user'), t('users.update_user_info'))"}
)

$template = @'
    async function initPage() {
      await waitForI18n();
      
      if (!isAuthenticated()) {
        window.location.href = '../index.html';
        return;
      }
      
      const user = getCurrentUser();
      document.getElementById('sidebar').innerHTML = createSidebar(user);
      document.getElementById('header').innerHTML = HEADER_PLACEHOLDER;
      initializeLanguageSwitcher();
      setActiveNav('ACTIVE_NAV');
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }
'@

Write-Host "Processing $($pages.Count) pages..." -ForegroundColor Cyan

foreach ($page in $pages) {
    $filePath = Join-Path $basePath $page.file
    if (Test-Path $filePath) {
        Write-Host "✓ Found: $($page.file)" -ForegroundColor Green
    } else {
        Write-Host "✗ Missing: $($page.file)" -ForegroundColor Red
    }
}

Write-Host "`nDone!" -ForegroundColor Green
