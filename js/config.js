// Configuração pública. A chave "publishable" é feita para ficar no frontend:
// quem protege os dados é a RLS + RPCs no Postgres (ver supabase/schema.sql).
// NUNCA colocar service_role aqui.
export const SUPABASE_URL = 'https://kpgzmedfxmatmuvujdhv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_eFot9s0A97-osO1h2UjOJg_SgNRGYKc';

// Contas fictícias criadas só para a demonstração (sem dado real).
export const DEMO_LOGIN = true;
export const DEMO = {
  cliente: { email: 'cliente.demo@lavbox.app', password: 'Lavbox#Demo2026' },
  lavador: { email: 'lavador.demo@lavbox.app', password: 'Lavbox#Demo2026' },
};

export const AGUA_CONVENCIONAL = 150; // litros (referência do documento do projeto)

// Fluxo de estados (espelha o enum order_status do banco e o DOCX, seção 11).
export const STATUS = [
  { id: 'solicitado', label: 'Solicitação recebida' },
  { id: 'confirmado', label: 'Profissional confirmado' },
  { id: 'a_caminho', label: 'Profissional a caminho' },
  { id: 'chegou', label: 'Profissional chegou' },
  { id: 'em_servico', label: 'Lavagem iniciada' },
  { id: 'finalizado', label: 'Lavagem finalizada' },
  { id: 'pago', label: 'Pagamento concluído' },
  { id: 'avaliado', label: 'Avaliação' },
];
export const statusLabel = (id) =>
  id === 'cancelado' ? 'Cancelado' : (STATUS.find((s) => s.id === id)?.label ?? id);
export const statusIndex = (id) => STATUS.findIndex((s) => s.id === id);

export const VEHICLE_TYPES = [
  { id: 'carro', label: 'Carro', mult: 1, icon: '🚗' },
  { id: 'moto', label: 'Moto', mult: 0.7, icon: '🏍️' },
  { id: 'suv', label: 'SUV', mult: 1.25, icon: '🚙' },
  { id: 'caminhonete', label: 'Caminhonete', mult: 1.4, icon: '🛻' },
  { id: 'van', label: 'Van', mult: 1.5, icon: '🚐' },
];
export const vehicleMult = (tipo) => VEHICLE_TYPES.find((v) => v.id === tipo)?.mult ?? 1;
export const vehicleIcon = (tipo) => VEHICLE_TYPES.find((v) => v.id === tipo)?.icon ?? '🚗';

// Catálogo usado pelo LocalAdapter (no Supabase vem das tabelas services/addons).
export const SEED_SERVICES = [
  { id: 'basico', nome: 'Básico', descricao: 'Lavagem externa, rodas, secagem e vidros', duracao_min: 30, preco: 35, agua_litros: 120, ecologico: false },
  { id: 'completo', nome: 'Completo', descricao: 'Externa + interna: aspiração, painel, vidros, rodas e acabamento', duracao_min: 60, preco: 70, agua_litros: 150, ecologico: false },
  { id: 'premium', nome: 'Premium', descricao: 'Completo + cera, hidratação interna, pneus e proteção de pintura', duracao_min: 120, preco: 140, agua_litros: 150, ecologico: false },
  { id: 'ecowash', nome: 'EcoWash', descricao: 'Lavagem a seco com produtos biodegradáveis (economia de água)', duracao_min: 45, preco: 60, agua_litros: 20, ecologico: true },
];
export const SEED_ADDONS = [
  { id: 'polimento', nome: 'Polimento', preco: 80 },
  { id: 'higienizacao', nome: 'Higienização interna', preco: 60 },
  { id: 'cristalizacao', nome: 'Cristalização', preco: 120 },
  { id: 'enceramento', nome: 'Enceramento', preco: 40 },
];

// Mesmo cálculo do servidor (create_order). O servidor é a fonte da verdade.
export function calcPrice(service, tipo, addons, addonList) {
  if (!service) return 0;
  const extra = addonList.filter((a) => addons.includes(a.id)).reduce((s, a) => s + Number(a.preco), 0);
  return Math.round((Number(service.preco) * vehicleMult(tipo) + extra) * 100) / 100;
}

export const addonNames = (ids = []) => ids.map((i) => SEED_ADDONS.find((a) => a.id === i)?.nome ?? i).join(', ');
