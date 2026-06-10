const MENU_OPTIONS = `Como podemos te ajudar? Digite o número da opção desejada:

1️⃣ – Novo mensalista
2️⃣ – Aumento de vagas no contrato
3️⃣ – 2ª via de boleto ou NF
4️⃣ – Recibo
5️⃣ – Selo Convênio
6️⃣ – Cancelamento
7️⃣ – Ouvidoria
8️⃣ – Trabalhe Conosco`;

const WELCOME_MESSAGE = `Olá! Seja bem-vindo à *GarageINN Estacionamentos*

${MENU_OPTIONS}`;

const RESPONSES = {
  '1': 'Obrigado pelo seu interesse! Em breve, um de nossos especialistas falará com você.\nEnquanto isso, conte um pouco mais sobre sua necessidade. Você já sabe qual unidade deseja contratar sua vaga ou deseja receber informações?',
  '2': 'Por favor, encaminhe um email para comercial@garageinn.com.br, com a Razão Social, CNPJ e a quantidade de vagas que deseja, informando se carro ou moto.',
  '3': `Caso sua solicitação seja para segunda via de boleto ou verificar suas informações financeiras, acesse o portal Omie: https://app.omie.com.br/login

Insira o seu e-mail cadastrado conosco (o mesmo que recebe os boletos mensalmente) e sua senha. Caso não lembre da senha ou não possua cadastro, clique em "Esqueci a senha" e receberá um e-mail com as orientações.

Esse portal dará acesso à segunda via de boletos e notas fiscais — todo o histórico financeiro do seu contrato conosco.`,
  '4': 'Por favor, encaminhar e-mail solicitando para nfe.avulso@garageinn.com',
  '5': 'Por favor, encaminhe um email para comercial@garageinn.com.br, com a Razão Social e CNPJ, informando as quantidades e períodos dos selos. Lembrando que nossa cartela contém apenas múltiplos de 20 por período.',
  '6': 'Por favor, para cancelamento formalizar através do link: https://forms.gle/jEcfJxCkxDMVuMNt7',
  '7': 'Por favor, encaminhar e-mail para renato@garageinn.com.br',
  '8': 'Por favor, preencher o link: https://tinyurl.com/tbconosco',
};

const INVALID_MESSAGE = 'Opção inválida. Por favor, escolha um número de 1 a 8.';

function getResponse(text) {
  const normalized = (text || '').trim();
  return RESPONSES[normalized] || INVALID_MESSAGE;
}

module.exports = { WELCOME_MESSAGE, MENU_OPTIONS, RESPONSES, getResponse };
