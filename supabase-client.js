(function () {
  if (!window.supabase || !window.SUPABASE_CONFIG) {
    console.error("Supabase : configuration ou bibliothèque introuvable.");
    return;
  }

  window.KYR_SUPABASE = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );

  console.log("KYR : Supabase connecté.");
})();
