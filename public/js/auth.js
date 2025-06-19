/**
 * Handles user logout by calling the logout API endpoint,
 * clearing all client-side storage, and redirecting to the login page.
 * This function should be used by all "Logout" buttons in the application.
 */
async function handleLogout() {
  try {
    const response = await fetch('/api/users/logout', { 
      method: 'POST', 
      credentials: 'include' 
    });

    if (!response.ok) {
        // Try to parse error, but don't let it stop the logout process
        const errorData = await response.json().catch(() => ({}));
        console.warn('Logout API call failed:', errorData.error || 'Server responded with an error.');
    }

  } catch (error) {
    console.error('Logout network error:', error);
  } finally {
    // **CRITICAL**: Always clear storage and redirect, even if the API call fails.
    // This ensures the user is logged out on the client-side, preventing a broken state.
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login.html';
  }
}

// Universal listener for any logout link with the id 'logoutLink'
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutLink');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});