const { getResponse, WELCOME_MESSAGE } = require('../menu');

describe('WELCOME_MESSAGE', () => {
  test('contém o nome da empresa', () => {
    expect(WELCOME_MESSAGE).toContain('GarageINN');
  });

  test('contém as 8 opções numeradas', () => {
    for (let i = 1; i <= 8; i++) {
      expect(WELCOME_MESSAGE).toContain(String(i));
    }
  });
});

describe('getResponse', () => {
  test('opção 1 retorna mensagem de novo mensalista', () => {
    expect(getResponse('1')).toContain('dados');
  });

  test('opção 2 retorna mensagem de aumento de vagas', () => {
    expect(getResponse('2')).toContain('Razão Social');
  });

  test('opção 3 retorna link do portal Omie', () => {
    expect(getResponse('3')).toContain('omie.com.br');
  });

  test('opção 4 retorna email de recibo', () => {
    expect(getResponse('4')).toContain('nfe.avulso@garageinn.com');
  });

  test('opção 5 retorna mensagem de selo convênio', () => {
    expect(getResponse('5')).toContain('nome');
  });

  test('opção 6 retorna link de cancelamento', () => {
    expect(getResponse('6')).toContain('forms.gle');
  });

  test('opção 7 retorna email de ouvidoria', () => {
    expect(getResponse('7')).toContain('renato@garageinn.com.br');
  });

  test('opção 8 retorna link de trabalhe conosco', () => {
    expect(getResponse('8')).toContain('tinyurl.com/tbconosco');
  });

  test('opção inválida retorna mensagem de erro', () => {
    expect(getResponse('99')).toContain('inválida');
    expect(getResponse('abc')).toContain('inválida');
    expect(getResponse('')).toContain('inválida');
  });

  test('aceita número com espaços extras', () => {
    expect(getResponse(' 1 ')).toContain('dados');
  });
});
