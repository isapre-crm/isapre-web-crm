export const defaultSiteContent = {
  "brand": {
    "name": "Tu Salud Primero",
    "navHome": "Inicio",
    "navCrm": "Portal CRM"
  },
  "hero": {
    "eyebrow": "ASESORÍA PERSONALIZADA EN CHILE",
    "title": "Tu salud merece un plan a tu medida.",
    "description": "Te ayudamos a conocer alternativas de Isapre y encontrar opciones que se ajusten a tus necesidades.",
    "primaryButton": "Solicitar asesoría",
    "secondaryButton": "Cotizar mi plan",
    "cardTitle": "Asesoría cercana y transparente",
    "cardDescription": "Conversa con un ejecutivo y recibe orientación personalizada.",
    "feature1": "Información clara",
    "feature2": "Atención humana",
    "feature3": "Contacto directo"
  },
  "isapres": {
    "eyebrow": "ALTERNATIVAS DE SALUD PRIVADA",
    "title": "Conoce las Isapres de Chile",
    "description": "Explora distintas alternativas para tu cobertura de salud.",
    "disclaimer": "Marcas mencionadas solo con fines informativos. Su aparición no implica representación, convenio ni asociación comercial."
  },
  "contact": {
    "eyebrow": "CONTACTO",
    "title": "Solicita una asesoría",
    "description": "Déjanos tus datos y un ejecutivo podrá contactarte.",
    "nameLabel": "Nombre completo",
    "namePlaceholder": "Tu nombre",
    "phoneLabel": "Teléfono de contacto",
    "phonePlaceholder": "+56 9 ...",
    "emailLabel": "Correo (opcional)",
    "emailPlaceholder": "correo@ejemplo.cl",
    "interestLabel": "Motivo de consulta",
    "option1": "Cotizar un plan",
    "option2": "Cambiar de Isapre",
    "option3": "Recibir asesoría",
    "submitButton": "Enviar solicitud",
    "privacyNotice": "Autorizo el uso de estos datos para responder a mi solicitud. Debe publicarse una política de privacidad definitiva antes del lanzamiento.",
    "medicalNotice": "No solicitamos antecedentes médicos en este formulario."
  },
  "whatsapp": {
    "eyebrow": "ATENCIÓN DIRECTA",
    "title": "¿Prefieres hablar con un asesor?",
    "description": "Conversemos por WhatsApp. Te orientamos sobre alternativas de Isapre y resolvemos tus dudas.",
    "button": "Conversar por WhatsApp",
    "small": "Se abrirá WhatsApp en una nueva ventana. No es necesario completar el formulario.",
    "phone": "56989494951",
    "message": "Hola, vengo desde la página Tu Salud Primero y me gustaría recibir asesoría sobre planes de salud.",
    "floatingLabel": "WhatsApp"
  },
  "footer": {
    "text": "Tu Salud Primero · Sitio de asesoría independiente · CRM v3.1 · Entorno de pruebas"
  },
  "appearance": {
    "primaryColor": "#087fa4",
    "accentColor": "#078d9b",
    "showHero": true,
    "showIsapres": true,
    "showContact": true,
    "showWhatsapp": true,
    "showFloatingWhatsapp": true
  }
} as const;
export type SiteContent = { [K in keyof typeof defaultSiteContent]: { [P in keyof (typeof defaultSiteContent)[K]]: (typeof defaultSiteContent)[K][P] extends boolean ? boolean : string } };
export const mergeSiteContent = (v: unknown): SiteContent => { const result: Record<string,Record<string,string|boolean>> = JSON.parse(JSON.stringify(defaultSiteContent)); if(v && typeof v==='object' && !Array.isArray(v)){ for(const section of Object.keys(result)){ const incoming=(v as Record<string,unknown>)[section]; if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))continue; for(const key of Object.keys(result[section])){const value=(incoming as Record<string,unknown>)[key]; if(typeof value===typeof result[section][key])result[section][key]=value as string|boolean; }}} return result as SiteContent; };
