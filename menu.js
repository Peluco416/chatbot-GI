const WELCOME_MESSAGE = `Olá! Seja bem-vindo à *GarageINN Estacionamentos* 🅿️

Como podemos te ajudar? Digite o número da opção desejada:

1️⃣ – Novo mensalista
2️⃣ – Aumento de vagas no contrato
3️⃣ – 2ª via de boleto ou NF
4️⃣ – Recibo
5️⃣ – Selo Convênio
6️⃣ – Cancelamento
7️⃣ – Ouvidoria
8️⃣ – Trabalhe Conosco`;

const RESPONSES = {
  '1': 'Deixe seus dados que já entraremos em contato.',
  '2': 'Por favor, nos informe sua Razão Social e CNPJ/CPF que já entraremos em contato.',
  '3': `Caso sua solicitação seja para segunda via de boleto ou verificar suas informações financeiras, acesse o portal Omie: https://app.omie.com.br/login

Insira o seu e-mail cadastrado conosco (o mesmo que recebe os boletos mensalmente) e sua senha. Caso não lembre da senha ou não possua cadastro, clique em "Esqueci a senha" e receberá um e-mail com as orientações.

Esse portal dará acesso à segunda via de boletos e notas fiscais — todo o histórico financeiro do seu contrato conosco.`,
  '4': 'Por favor, encaminhar e-mail solicitando para nfe.avulso@garageinn.com',
  '5': 'Deixe seu nome que já entraremos em contato ou, se já é nosso parceiro, nos informe a Razão Social e CNPJ.',
  '6': 'Por favor, para cancelamento formalizar através do link: https://forms.gle/jEcfJxCkxDMVuMNt7',
  '7': 'Por favor, encaminhar e-mail para renato@garageinn.com.br',
  '8': 'Por favor, preencher o link: https://tinyurl.com/tbconosco',
};

const INVALID_MESSAGE = 'Opção inválida. Por favor, escolha um número de 1 a 8.';

function getResponse(text) {
  const normalized = (text || '').trim();
  return RESPONSES[normalized] || INVALID_MESSAGE;
}

module.exports = { WELCOME_MESSAGE, RESPONSES, getResponse };
