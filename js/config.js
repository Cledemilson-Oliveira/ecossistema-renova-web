export const RENOVA_CONFIG = Object.freeze({
  supabaseUrl: 'https://nnjvxomaermffqnmwtzr.supabase.co',
  supabasePublishableKey: 'REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY',
  siteUrl: 'https://ecossistemarenova.servicosgold.com.br',
  githubPagesUrl: 'https://cledemilson-oliveira.github.io/ecossistema-renova-web/',
  brand: {
    name: 'Ecossistema RENOVA',
    slogan: 'Gestão • Controle • Resultados',
    developer: 'Cledemilson Oliveira de Assis',
    developerRole: 'Desenvolvedor do Ecossistema RENOVA',
    logoUrl: 'https://nnjvxomaermffqnmwtzr.supabase.co/storage/v1/object/public/branding-renova/LOGO%20OFICIAL%20RENOVA.png',
    developerPhotoUrl: 'https://nnjvxomaermffqnmwtzr.supabase.co/storage/v1/object/public/branding-renova/Dono%20do%20Ecossistema%20RENOVA.png'
  }
});

export function isSupabaseConfigured(){
  return Boolean(
    RENOVA_CONFIG.supabaseUrl &&
    RENOVA_CONFIG.supabasePublishableKey &&
    !RENOVA_CONFIG.supabasePublishableKey.startsWith('REPLACE_')
  );
}

// Segurança: somente a chave pública/anon/publishable pode ficar neste arquivo.
// Nunca adicionar service_role, Access Token do Mercado Pago ou qualquer segredo privado.
