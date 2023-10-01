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

//novos objetos serão colocados aqui para maior organização do código.

module.exports = 
{ 
    UserTypes, 
    Genders
};