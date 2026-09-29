// Seleciona o adapter de dados. ?mode=local => LocalAdapter (fallback offline da demo).
export const mode = new URLSearchParams(location.search).get('mode') === 'local' ? 'local' : 'supabase';
export const slot = new URLSearchParams(location.search).get('slot') || '';
export const { adapter: api } = await import(mode === 'local' ? './adapters/local.js' : './adapters/supabase.js');
