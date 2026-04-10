(() => {
  const AUTH_KEY = 'estoque_cvs_auth';

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
    if (!Sync.hasConfiguredGasUrl()) {
      throw new Error('Configure primeiro a URL do Apps Script na Home.');
    }

    const result = await Sync.whoAmI();
    if (!result.ok) {
      throw new Error(result.error?.message || 'Não foi possível autenticar com o Web App.');
    }

    return setUser({
      email: result.data.email,
      token: btoa(`${result.data.email}:${Date.now()}`),
      loggedAt: new Date().toISOString(),
    });
  }

  window.Auth = { getUser, setUser, clearUser, loginWithGoogle };
})();
