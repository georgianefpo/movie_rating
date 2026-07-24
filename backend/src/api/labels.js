// Rotulos legiveis dos codigos do MovieLens (para exibir no front).

export const AGE_LABELS = {
    1: 'Menor de 18',
    18: '18-24',
    25: '25-34',
    35: '35-44',
    45: '45-49',
    50: '50-55',
    56: '56+',
};

export const OCCUPATION_LABELS = {
    0: 'outro / nao especificado',
    1: 'academico / educador',
    2: 'artista',
    3: 'administrativo',
    4: 'estudante (universitario/pos)',
    5: 'atendimento ao cliente',
    6: 'medico / saude',
    7: 'executivo / gerencial',
    8: 'agricultor',
    9: 'do lar',
    10: 'estudante (K-12)',
    11: 'advogado',
    12: 'programador',
    13: 'aposentado',
    14: 'vendas / marketing',
    15: 'cientista',
    16: 'autonomo',
    17: 'tecnico / engenheiro',
    18: 'artesao / tecnico manual',
    19: 'desempregado',
    20: 'escritor',
};

export const ageLabel = (code) => AGE_LABELS[code] ?? String(code);
export const occupationLabel = (code) => OCCUPATION_LABELS[code] ?? String(code);
