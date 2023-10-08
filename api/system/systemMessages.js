//Classe criada para exportar mensagens de erro e demais mensagens do sistema para manter o código limpo e padronizado.
//vou colocando aqui conforme for lembrando.. - Igor
const ErrorMessages = Object.freeze({
    INCORRECT_PHONE_NUMBER: { message: 'O telefone informado é inválido!' },
    INEXISTENT_USER: { message: 'Usuário informado não existe.' },
    INCORRECT_PASSWORD: { message: 'Senha incorreta.' },
    INCORRECT_USER: { message: 'Usuário ou senha incorretos.' },
    INCORRECT_GENDER: { message: 'O gênero informado não é um número.' },
    INCORRECT_EMAIL: { message: 'O campo EMAIL informado não é um e-mail válido.' },
    INCORRECT_POSTAL_CODE: { message: 'O CEP informado é inválido.' },
    EMAIL_ALREADY_EXISTS: { message: 'E-mail informado já existe.' },
    USER_ALREADY_HAS_ADDRESS: { message: 'Você já possui endereço cadastrado!' },
    INCORRECT_CITY: { message: 'A cidade informada não existe.' },
    TOO_MUCH_TRIES: { message: 'Muitas tentativas de login, tente novamente mais tarde. Caso você atinja 3 tentativas, seu usuário será bloqueado.' },
    BLOCKED_TOO_MUCH_TRIES: { message: 'Usuário bloqueado por muitas tentativas de login incorretas, entre em contato com o suporte.' },
    BANNED_USER_MESSAGE: { message: 'Você está banido da plataforma. Contate o suporte para maiores informações.' },
    ALREADY_HAS_A_TOKEN_IN_PROGRESS: { message: 'Você já possui um token em andamento, por favor aguarde 15 minutos para solicitar um novo.' },
    TOKEN_HAS_EXPIRED: { message: 'Este token expirou, por favor peça um novo atualizando a página.' },
    INVALID_BLOB: { message: 'A imagem enviada é inválida.' },
});

module.exports =
{
    ErrorMessages
};