(() => {
  const AUTH_KEY = 'auth_user';

  function getUser() {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setUser(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  }

  function clearUser() {
    localStorage.removeItem(AUTH_KEY);
  }

  async function loginWithGoogle() {
    // Placeholder de UX para GitHub Pages estático.
    // Produção: integrar Google Identity Services e enviar idToken no sync.
    const email = prompt('Informe seu e-mail corporativo Google:');
    if (!email) throw new Error('Login cancelado');
    const token = btoa(`${email}:${Date.now()}`);
    return setUser({ email: email.trim().toLowerCase(), token, loggedAt: new Date().toISOString() });
  }

  window.Auth = { getUser, setUser, clearUser, loginWithGoogle };
})();
