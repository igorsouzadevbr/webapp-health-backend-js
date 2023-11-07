const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const jwt = require('jsonwebtoken');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');

class chatAttendantFlow {

    constructor(connection) {
        this.connection = connection;
    }

    async turnAttendantOffline(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { email } = req.body;

        if (!util.isEmail(email)) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

        const userData = await databaseFramework.select("users", "*", "email = ? and usertype = ?", [email, systemObjects.UserTypes.ATENDENTE.id]);
        if (userData.length === 0) { return res.status(401).send({ message: 'O usuário informado nao existe ou nao é do tipo atendente.' }); }

        const userId = userData[0].id;
        const isAttendantOnline = await databaseFramework.select("chat_attendants", "*", "isAvailable = 1 and attendant_id = ?", [userId]);

        if (isAttendantOnline.length === 1) {

            try {
                await databaseFramework.update("chat_attendants", { isAvailable: 0 }, `attendant_id = ${userId}`);
                return res.status(200).json({ message: 'Você agora está offline.' });
            } catch (error) {
                return res.status(500).json({ message: 'Ocorreu um erro interno. Acione o suporte.' });
            }
        }

        return res.status(409).json({ message: 'Este usuário já está offline.' });

    }

    async turnAttendantOnline(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { email, category } = req.body;

        if (!util.isInteger(category)) { return res.status(409).json({ message: 'Informe uma categoria válida.' }); }
        if (!util.isEmail(email)) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

        const categoryIds = Object.values(systemObjects.ChatCategories).map(category => category.id);
        if (!categoryIds.includes(parseInt(category))) {
            return res.status(409).json({ message: 'Categoria inválida.' });
        }

        const userData = await databaseFramework.select("users", "*", "email = ? and usertype = ?", [email, systemObjects.UserTypes.ATENDENTE.id]);

        if (userData.length === 0) { return res.status(401).send({ message: 'O usuário informado nao existe ou nao é do tipo atendente.' }); }

        const userId = userData[0].id;
        const isAttendantAlreadyOnline = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [userId]);

        if (isAttendantAlreadyOnline.length <= 0) {
            try {
                await databaseFramework.insert("chat_attendants", { attendant_id: userId, category_id: category, isAvailable: 1 });
                return res.status(200).json({ message: 'Você agora está online e receberá novos chamados.' });
            } catch (error) {
                return res.status(500).json({ message: 'Ocorreu um erro interno. Acione o suporte.' });
            }
        }
        const attendantStatusData = isAttendantAlreadyOnline[0];
        if (attendantStatusData.category_id != category || attendantStatusData.isAvailable === 0) {
            try {
                await databaseFramework.update("chat_attendants", { isAvailable: 1, category_id: category }, `attendant_id = ${userId}`);
                return res.status(200).json({ message: 'Agora você está online na categoria: ' + systemObjects.getCategoryNameById(category) + "." });
            } catch (error) {
                return res.status(500).json({ message: 'Ocorreu um erro interno. Acione o suporte.' });
            }
        }
        return res.status(400).json({ message: 'Você já está on-line na categoria selecionada.' });

    }

    async getAllAttendantsFromDB(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        try {
            const getChatAttendants = await databaseFramework.select("chat_attendants", "*");
            if (getChatAttendants.length <= 0) { return res.status(404).json({ message: 'Não há atendentes disponíveis.' }); }

            const attendantIds = getChatAttendants.map(attendant => attendant.attendant_id);
            // Busque os nomes dos atendentes na tabela 'users'
            const getAttendantData = await databaseFramework.select("users", ["id", "name", "userphoto", "role"], "id IN (?)", [attendantIds]);

            const attendantNameData = {};
            getAttendantData.forEach(attendant => {
                attendantNameData[attendant.id] = attendant.name;
            });

            const attendantRoleData = {};
            getAttendantData.forEach(attendant => {
                attendantRoleData[attendant.id] = attendant.role;
            });

            const attendantPhotoData = {};
            getAttendantData.forEach(attendant => {
                attendantPhotoData[attendant.id] = `${attendant.userphoto}`;
            });

            const attendantFinalData = getChatAttendants.map(attendant => ({
                ...attendant,
                attendantName: attendantNameData[attendant.attendant_id],
                attendantPhoto: attendantPhotoData[attendant.attendant_id],
                attendantRole: attendantRoleData[attendant.attendant_id]
            }));

            return res.status(200).send(attendantFinalData);
        } catch (error) {
            return res.status(500).send({ message: error.message });
        }
    }

    async getAttendantsByCategoryFromDB(req, res) {
        const { categoryId } = req.body;

        const categoryIds = Object.values(systemObjects.ChatCategories).map(category => category.id);
        if (!categoryIds.includes(parseInt(categoryId))) {
            return res.status(409).json({ message: 'Categoria inválida.' });
        }
        const databaseFramework = new dbUtils(this.connection);
        try {
            const getChatAttendants = await databaseFramework.select("chat_attendants", "*", "category_id = ?", [categoryId]);
            if (getChatAttendants.length <= 0) { return res.status(404).json({ message: 'Não há atendentes disponíveis.' }); }
            return res.status(200).send(getChatAttendants);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async getAttendantsByNameFromDB(req, res) {
        const { attendantName } = req.body;
        const databaseFramework = new dbUtils(this.connection);
        try {

            const getAttendantName = await databaseFramework.select("users", "*", "name = ?"[attendantName]);
            if (getAttendantName.length <= 0) { return res.status(404).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message }); }

            const attendantId = getAttendantName[0].name;
            const getChatAttendants = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [attendantId]);

            return res.status(200).send(getChatAttendants);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

}
module.exports = chatAttendantFlow;