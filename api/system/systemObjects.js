const UserTypes = Object.freeze({
    PACIENTE: { id: 1, name: 'Paciente' },
    ATENDENTE: { id: 2, name: 'Atendente' },
    PROFISSIONAL: { id: 3, name: 'Profissional' },
    ADMIN: { id: 4, name: 'Admin' },
});

const Genders = Object.freeze({
    MASCULINO: { id: 1, name: 'Masculino' },
    FEMININO: { id: 2, name: 'Feminino' },
    PNI: { id: 3, name: 'Prefiro não informar' },
});

const ChatCategories = Object.freeze({
    HOMEM: { id: 1, name: 'Homem' },
    MULHER: { id: 2, name: 'Mulher' },
    LGBTQIA: { id: 3, name: 'LGBTQIA+' },
    TODOS: { id: 4, name: 'Todos' },
});

//novos objetos serão colocados aqui para maior organização do código.

module.exports = 
{ 
    UserTypes, 
    Genders,
    ChatCategories
};